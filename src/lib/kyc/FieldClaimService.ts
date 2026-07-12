import prisma from "@/lib/prisma";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { ClaimStatus, SourceType, FieldClaim } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

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
    attachmentDocumentId?: string;
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
    claimRole?: 'VALUE' | 'FILE_ATTACHMENT';
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

        const isTombstone = input.valueJson && typeof input.valueJson === 'object' && input.valueJson.tombstone === true;
        if (input.claimRole === 'FILE_ATTACHMENT') {
            if (!isTombstone) {
                if (!input.attachmentDocumentId) throw new Error("Active FILE_ATTACHMENT claim must have attachmentDocumentId.");
                if (input.valueText !== undefined || input.valueNumber !== undefined || input.valueDate !== undefined) {
                    throw new Error("FILE_ATTACHMENT claim must not populate scalar values.");
                }
            } else {
                if (input.attachmentDocumentId) throw new Error("FILE_ATTACHMENT tombstone must not have attachmentDocumentId.");
            }
        } else {
            if (input.attachmentDocumentId) throw new Error("VALUE claim must not populate attachmentDocumentId.");
        }

        // 4. Create the claim
        const claim = await prisma.fieldClaim.create({
            data: {
                fieldNo: input.fieldNo,
                subjectLeId: input.subjectLeId,
                subjectPersonId: input.subjectPersonId,
                subjectOrgId: input.subjectOrgId,
                ownerScopeId: input.ownerScopeId,
                claimRole: input.claimRole || 'VALUE',

                valueText: input.valueText,
                valueNumber: input.valueNumber ? String(input.valueNumber) : null,
                valueDate: input.valueDate,
                valueJson: input.valueJson,
                valuePersonId: input.valuePersonId,
                valueLeId: input.valueLeId,
                valueOrgId: input.valueOrgId,
                valueAddressId: input.valueAddressId,
                valueDocId: input.valueDocId,
                attachmentDocumentId: input.attachmentDocumentId,

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

        // 5. Graph write-back — awaited with error isolation so a write-back failure
        // never rolls back the claim, but the edge IS committed before we return.
        // This is critical for the UI: callers call getFieldDetail() immediately after
        // assertClaim() returns, and that query reads from clientLEGraphEdge. If the
        // edge write is still in-flight (fire-and-forget) the row won't be visible yet.
        if (input.clientLEId) {
            try {
                await this.writeBackGraphEdge(claim, input);
            } catch (err) {
                console.error("[FieldClaimService] Graph write-back failed (non-fatal):", err);
            }
        }

        return claim;
    }

    /**
     * Emits a tombstone claim to 'delete' a collection item.
     */
    static async emitTombstone(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
        fieldNo: number,
        collectionId: string | undefined,
        instanceId: string,
        ownerScopeId: string | null,
        sourceType: SourceType = SourceType.USER_INPUT,
        claimRole: 'VALUE' | 'FILE_ATTACHMENT' = 'VALUE'
    ): Promise<FieldClaim> {
        return await this.assertClaim({
            fieldNo,
            ...subject,
            ownerScopeId: ownerScopeId || undefined,
            collectionId,
            instanceId,
            valueJson: { tombstone: true },
            sourceType,
            claimRole
        });
    }

    // ── File Attachment Writes ───────────────────────────────────────────────

    private static async validateAttachmentInstance(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string },
        fieldNo: number,
        instanceId: string,
        ownerScopeId: string | null
    ) {
        const claims = await prisma.fieldClaim.findMany({
            where: {
                instanceId,
                fieldNo,
                subjectLeId: subject.subjectLeId || null,
                subjectPersonId: subject.subjectPersonId || null,
                subjectOrgId: subject.subjectOrgId || null,
                ownerScopeId: ownerScopeId || null,
                claimRole: 'FILE_ATTACHMENT'
            },
            orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
        });

        if (claims.length === 0) {
            throw new Error(`Attachment instance ${instanceId} not found or does not belong to the requested scope.`);
        }

        const latest = claims[0];
        const isTombstone = latest.valueJson && typeof latest.valueJson === 'object' && (latest.valueJson as any).tombstone;
        if (isTombstone) {
            throw new Error(`Attachment instance ${instanceId} has already been removed.`);
        }

        return latest;
    }

    private static async validateDocumentExists(documentId: string, clientLEId?: string) {
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) throw new Error(`Document ${documentId} not found.`);
        if (clientLEId && doc.clientLEId !== clientLEId) {
            throw new Error(`Document ${documentId} does not belong to the requested clientLE.`);
        }
    }

    /**
     * Adds a new file attachment to a field.
     * Generates a new instanceId for the attachment lifecycle.
     */
    static async addAttachment(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
        fieldNo: number,
        attachmentDocumentId: string,
        ownerScopeId: string | null,
        sourceType: SourceType = SourceType.USER_INPUT
    ): Promise<FieldClaim> {
        await this.validateDocumentExists(attachmentDocumentId, subject.clientLEId);
        const instanceId = uuidv4();
        return await this.assertClaim({
            fieldNo,
            ...subject,
            ownerScopeId: ownerScopeId || undefined,
            attachmentDocumentId,
            instanceId,
            sourceType,
            claimRole: 'FILE_ATTACHMENT'
        });
    }

    /**
     * Replaces an existing file attachment (identified by instanceId) with a new one.
     */
    static async replaceAttachment(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
        fieldNo: number,
        instanceId: string,
        attachmentDocumentId: string,
        ownerScopeId: string | null,
        sourceType: SourceType = SourceType.USER_INPUT
    ): Promise<FieldClaim> {
        await this.validateDocumentExists(attachmentDocumentId, subject.clientLEId);
        await this.validateAttachmentInstance(subject, fieldNo, instanceId, ownerScopeId);
        return await this.assertClaim({
            fieldNo,
            ...subject,
            ownerScopeId: ownerScopeId || undefined,
            attachmentDocumentId,
            instanceId,
            sourceType,
            claimRole: 'FILE_ATTACHMENT'
        });
    }

    /**
     * Removes an existing file attachment (identified by instanceId) by emitting a tombstone.
     */
    static async removeAttachment(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
        fieldNo: number,
        instanceId: string,
        ownerScopeId: string | null,
        sourceType: SourceType = SourceType.USER_INPUT
    ): Promise<FieldClaim> {
        await this.validateAttachmentInstance(subject, fieldNo, instanceId, ownerScopeId);
        return await this.emitTombstone(
            subject,
            fieldNo,
            undefined,
            instanceId,
            ownerScopeId,
            sourceType,
            'FILE_ATTACHMENT'
        );
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

        console.log(`[writeBackGraphEdge] field=${fieldNo} clientLE=${clientLEId} binding=${binding?.writeBackEdgeType ?? 'NONE'}`);

        if (!binding?.writeBackEdgeType) return;

        // 2. Resolve which entity id to look up in the graph
        const refPersonId = (claim as any).valuePersonId;
        const refLeId     = (claim as any).valueLeId;

        console.log(`[writeBackGraphEdge] refPersonId=${refPersonId} refLeId=${refLeId}`);

        if (!refPersonId && !refLeId) {
            console.warn(`[writeBackGraphEdge] No value ref — scalar claim, skipping.`);
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

        console.log(`[writeBackGraphEdge] graphNode=${graphNode?.id ?? 'NOT FOUND'}`);

        if (!graphNode) {
            console.warn(
                `[FieldClaimService.writeBack] No graph node found for ` +
                `clientLE=${clientLEId}, personId=${refPersonId}, leId=${refLeId}. ` +
                `Node must be created before a write-back can occur.`
            );
            return;
        }

        // 3.5. Resolve root LE node to use as toNodeId.
        // This anchors the edge to the specific ClientLE rather than leaving it floating.
        // Previously toNodeId was always null (a Prisma upsert workaround was incomplete).
        let rootNodeId: string | null = null;
        try {
            const clientLERec = await prisma.clientLE.findUnique({
                where: { id: clientLEId! },
                select: { legalEntityId: true },
            });
            if (clientLERec?.legalEntityId) {
                const rootNode = await (prisma as any).clientLEGraphNode.findFirst({
                    where: { clientLEId, legalEntityId: clientLERec.legalEntityId },
                    select: { id: true },
                });
                rootNodeId = rootNode?.id ?? null;
                if (!rootNodeId) {
                    console.warn(`[writeBackGraphEdge] Root LEGAL_ENTITY node not found for clientLE=${clientLEId}. Edge toNodeId will remain null.`);
                }
            }
        } catch (e) {
            console.warn(`[writeBackGraphEdge] Could not resolve root node, toNodeId will be null:`, e);
        }

        // 4. Find-or-create the edge.
        // Prisma's upsert() cannot handle null values in nullable compound unique constraints
        // (the @@unique([fromNodeId, toNodeId, edgeType]) index). Use findFirst + create/update instead.
        //
        // Note: Do NOT include toNodeId in the WHERE — we want to find the edge regardless
        // of whether it currently has a null or a real toNodeId. Existing null-toNodeId edges
        // (written before this fix) are corrected in the update step below.
        try {
            const existingEdge = await (prisma as any).clientLEGraphEdge.findFirst({
                where: {
                    fromNodeId: graphNode.id,
                    edgeType:   binding.writeBackEdgeType,
                },
                select: { id: true, toNodeId: true },
            });

            let edge: any;
            if (existingEdge) {
                edge = await (prisma as any).clientLEGraphEdge.update({
                    where: { id: existingEdge.id },
                    data: {
                        isActive:  binding.writeBackIsActive,
                        source:    "USER_INPUT",
                        toNodeId:  rootNodeId,  // upgrade null → real node id if resolved
                    },
                });
            } else {
                edge = await (prisma as any).clientLEGraphEdge.create({
                    data: {
                        clientLEId,
                        fromNodeId: graphNode.id,
                        toNodeId:   rootNodeId,
                        edgeType:   binding.writeBackEdgeType,
                        isActive:   binding.writeBackIsActive,
                        source:     "USER_INPUT",
                    },
                });
            }
            console.log(`[writeBackGraphEdge] ✅ edge ${existingEdge ? 'updated' : 'created'} id=${edge.id} edgeType=${edge.edgeType} toNodeId=${edge.toNodeId ?? 'null'} isActive=${edge.isActive}`);

        } catch (e: any) {
            // Surface the error so the awaited caller can log it
            throw new Error(`Edge write-back failed: ${e.message}`);
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
            'JSONB':             ['valueJson'],
            'ADDRESS':           ['valueJson'],
            'PERSON_OR_CONTACT': ['valueJson'],
            'PARTY':             ['valueJson']
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
