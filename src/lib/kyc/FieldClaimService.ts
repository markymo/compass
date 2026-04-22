import prisma from "@/lib/prisma";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { ClaimStatus, SourceType, FieldClaim } from "@prisma/client";

export type AssertClaimInput = {
    fieldNo: number;
    // Who (Exactly one)
    subjectLeId?: string;
    subjectPersonId?: string;
    subjectOrgId?: string;
    // Whose
    ownerScopeId?: string; // null = baseline
    // What (Value families)
    valueText?: string;
    valueNumber?: number | string; // Decimal-compatible
    valueDate?: Date;
    valueJson?: any;
    valuePersonId?: string;
    valueLeId?: string;
    valueOrgId?: string;
    valueAddressId?: string;
    valueDocId?: string;
    // Why
    sourceType: SourceType;
    sourceReference?: string;
    evidenceId?: string;
    confidenceScore?: number;
    // When
    assertedAt?: Date;
    effectiveFrom?: Date;
    effectiveTo?: Date;
    // Lineage
    supersedesId?: string;
    // Multiplicity
    collectionId?: string;
    instanceId?: string;
    status?: ClaimStatus;
    verifiedByUserId?: string;
    /**
     * The ClientLE record that owns this assertion.
     * Required for graph write-back: when provided and the field has a
     * MasterFieldGraphBinding with writeBackEdgeType, the service will
     * upsert a ClientLEGraphEdge after the claim is persisted.
     *
     * Only fires when sourceType === USER_INPUT — automated ingestion paths
     * (KycWriteService, GLEIF, Registry connectors) manage their own edges.
     */
    clientLEId?: string;
};

export class FieldClaimService {
    /**
     * Asserts a new fact (claim) about a subject.
     * Enforces invariants and handles lineage.
     *
     * If `input.clientLEId` is provided and `sourceType === USER_INPUT`, this
     * method also checks for a MasterFieldGraphBinding on the field and upserts
     * a ClientLEGraphEdge if writeBackEdgeType is configured. This is the
     * idempotent write-back mechanism described in the architecture design.
     */
    static async assertClaim(input: AssertClaimInput): Promise<FieldClaim> {
        // 1. Invariant: Exactly one subject FK
        const subjects = [input.subjectLeId, input.subjectPersonId, input.subjectOrgId].filter(Boolean);
        if (subjects.length !== 1) {
            throw new Error("FieldClaim must have exactly one subject (LE, Person, or Org).");
        }

        // 2. Fetch Field Definition for validation
        const fieldDef = await getMasterFieldDefinition(input.fieldNo);

        // 3. Invariant: Logical value slot matches FieldDefinition
        this.validateValueSlot(input, fieldDef);

        // 4. Create the claim
        const claim = await prisma.fieldClaim.create({
            data: {
                fieldNo: input.fieldNo,
                subjectLeId: input.subjectLeId,
                subjectPersonId: input.subjectPersonId,
                subjectOrgId: input.subjectOrgId,
                ownerScopeId: input.ownerScopeId,

                valueText: input.valueText,
                valueNumber: input.valueNumber ? String(input.valueNumber) : null,
                valueDate: input.valueDate,
                valueJson: input.valueJson,
                valuePersonId: input.valuePersonId,
                valueLeId: input.valueLeId,
                valueOrgId: input.valueOrgId,
                valueAddressId: input.valueAddressId,
                valueDocId: input.valueDocId,

                sourceType: input.sourceType,
                sourceReference: input.sourceReference,
                evidenceId: input.evidenceId,
                confidenceScore: input.confidenceScore,

                assertedAt: input.assertedAt || new Date(),
                effectiveFrom: input.effectiveFrom,
                effectiveTo: input.effectiveTo,
                supersedesId: input.supersedesId,

                collectionId: input.collectionId,
                instanceId: input.instanceId,

                status: input.status || ClaimStatus.ASSERTED,
                verifiedByUserId: input.verifiedByUserId || undefined,
                verifiedAt: input.status === ClaimStatus.VERIFIED ? (input.assertedAt || new Date()) : null,
            }
        });

        // 5. Graph write-back (USER_INPUT only)
        if (input.clientLEId && input.sourceType === SourceType.USER_INPUT) {
            // Fire-and-forget with error isolation — a write-back failure must never
            // roll back the claim itself.
            this.writeBackGraphEdge(claim, input).catch(err => {
                console.error("[FieldClaimService] Graph write-back failed (non-fatal):", err);
            });
        }

        return claim;
    }

    /**
     * Emits a tombstone claim to 'delete' a collection item.
     */
    static async emitTombstone(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string },
        fieldNo: number,
        collectionId: string,
        instanceId: string,
        ownerScopeId: string | null,
        sourceType: SourceType = SourceType.USER_INPUT
    ): Promise<FieldClaim> {
        return await this.assertClaim({
            fieldNo,
            ...subject,
            ownerScopeId: ownerScopeId || undefined,
            collectionId,
            instanceId,
            valueJson: { tombstone: true },
            sourceType
        });
    }

    /**
     * Promotes a claim to VERIFIED status.
     */
    static async verifyClaim(claimId: string, userId: string): Promise<FieldClaim> {
        return await prisma.fieldClaim.update({
            where: { id: claimId },
            data: {
                status: ClaimStatus.VERIFIED,
                verifiedByUserId: userId,
                verifiedAt: new Date(),
            }
        });
    }

    /**
     * Explicitly rejects a claim.
     */
    static async rejectClaim(claimId: string): Promise<FieldClaim> {
        return await prisma.fieldClaim.update({
            where: { id: claimId },
            data: {
                status: ClaimStatus.REJECTED,
            }
        });
    }

    // ── Private: Graph Write-Back ──────────────────────────────────────────

    /**
     * Idempotent write-back: if the field has a MasterFieldGraphBinding with a
     * writeBackEdgeType, upserts a ClientLEGraphEdge linking the claimed node
     * to the root LE.
     *
     * Design invariants:
     * - Only fires for USER_INPUT source claims (registry / GLEIF paths own their edges)
     * - Requires a value reference (valuePersonId or valueLeId) — scalar claims skip silently
     * - The graph node for the referenced person/entity must already exist in the LE graph
     *   (the GraphNodePicker always selects from existing nodes; Create New will upsert first)
     * - Uses the DB unique constraint ([fromNodeId, edgeType]) as the idempotency key,
     *   so duplicate calls are safe
     * - A failure here never rolls back the parent claim
     */
    private static async writeBackGraphEdge(claim: FieldClaim, input: AssertClaimInput): Promise<void> {
        const { clientLEId, fieldNo } = input;
        if (!clientLEId) return;

        // 1. Find active binding for this field
        const binding = await (prisma as any).masterFieldGraphBinding.findFirst({
            where: {
                fieldNo,
                isActive: true,
                writeBackEdgeType: { not: null },
            },
        });

        if (!binding?.writeBackEdgeType) return;

        // 2. Resolve which entity id to look up in the graph
        const refPersonId = (claim as any).valuePersonId;
        const refLeId     = (claim as any).valueLeId;

        if (!refPersonId && !refLeId) {
            // Scalar claim — no node reference to write back
            return;
        }

        // 3. Find the graph node for this clientLE that corresponds to the referenced entity
        const graphNode = await (prisma as any).clientLEGraphNode.findFirst({
            where: {
                clientLEId,
                ...(refPersonId ? { personId: refPersonId } : {}),
                ...(refLeId     ? { legalEntityId: refLeId } : {}),
            },
            select: { id: true },
        });

        if (!graphNode) {
            console.warn(
                `[FieldClaimService.writeBack] No graph node found for ` +
                `clientLE=${clientLEId}, personId=${refPersonId}, leId=${refLeId}. ` +
                `Node must be created before a write-back can occur.`
            );
            return;
        }

        // 4. Upsert the edge — idempotent via unique(fromNodeId, edgeType)
        // We update isActive=true on conflict, restoring a previously-ceased edge
        // if the user re-asserts the same relationship.
        try {
            await (prisma as any).clientLEGraphEdge.upsert({
                where: {
                    fromNodeId_edgeType: {
                        fromNodeId: graphNode.id,
                        edgeType:   binding.writeBackEdgeType,
                    },
                },
                update: {
                    isActive:  binding.writeBackIsActive,
                    source:    "USER_INPUT",
                },
                create: {
                    clientLEId,
                    fromNodeId: graphNode.id,
                    toNodeId:   null, // null = root LE
                    edgeType:   binding.writeBackEdgeType,
                    isActive:   binding.writeBackIsActive,
                    source:     "USER_INPUT",
                },
            });
        } catch (e: any) {
            // Log the error but surface it to the caller so fire-and-forget can log it
            throw new Error(`Edge upsert failed: ${e.message}`);
        }
    }

    // ── Private: Validation ────────────────────────────────────────────────

    /**
     * Validates that the input value slot is consistent with the field's appDataType.
     */
    private static validateValueSlot(input: AssertClaimInput, fieldDef: any) {
        // If it's a tombstone (valueJson with tombstone: true), skip data type validation
        if (input.valueJson?.tombstone === true) return;

        const typeMap: Record<string, string[]> = {
            'TEXT':         ['valueText'],
            'NUMBER':       ['valueNumber'],
            'DATE':         ['valueDate'],
            'DATETIME':     ['valueDate'],
            'PERSON_REF':   ['valuePersonId'],
            'ORG_REF':      ['valueLeId', 'valueOrgId'],
            'PARTY_REF':    ['valuePersonId', 'valueLeId', 'valueOrgId'],
            'ADDRESS_REF':  ['valueAddressId'],
            'DOCUMENT_REF': ['valueDocId'],
            'JSONB':        ['valueJson']
        };

        const allowedSlots = typeMap[fieldDef.appDataType] || [];
        const providedSlots = [
            input.valueText      ? 'valueText'      : null,
            input.valueNumber    ? 'valueNumber'     : null,
            input.valueDate      ? 'valueDate'       : null,
            input.valueJson      ? 'valueJson'       : null,
            input.valuePersonId  ? 'valuePersonId'   : null,
            input.valueLeId      ? 'valueLeId'       : null,
            input.valueOrgId     ? 'valueOrgId'      : null,
            input.valueDocId     ? 'valueDocId'      : null
        ].filter(Boolean);

        if (providedSlots.length > 0) {
            const isAllowed = providedSlots.every((slot: any) => allowedSlots.includes(slot!));
            if (!isAllowed) {
                // We'll throw in the future, but for now we warn and continue
                console.warn(`[FieldClaimService] Field ${fieldDef.fieldNo} (${fieldDef.fieldName}) expects ${fieldDef.appDataType}, but provided slots: ${providedSlots.join(', ')}`);
            }
        }
    }
}
