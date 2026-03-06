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
    // What (Value familles)
    valueText?: string;
    valueNumber?: number | string; // Decimal-compatible
    valueDate?: Date;
    valueJson?: any;
    valuePersonId?: string;
    valueLeId?: string;
    valueOrgId?: string;
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
};

export class FieldClaimService {
    /**
     * Asserts a new fact (claim) about a subject.
     * Enforces invariants and handles lineage.
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

                status: input.status || ClaimStatus.ASSERTED, // Default to asserted
                verifiedByUserId: input.verifiedByUserId || undefined,
                verifiedAt: input.status === ClaimStatus.VERIFIED ? (input.assertedAt || new Date()) : null,
            }
        });

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
     * In the future, this will be the entry point for 'promoting' baseline to scoped if needed.
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

    /**
     * Validates that the input value slot is consistent with the field's appDataType.
     */
    private static validateValueSlot(input: AssertClaimInput, fieldDef: any) {
        // If it's a tombstone (valueJson with tombstone: true), skip data type validation
        if (input.valueJson?.tombstone === true) return;

        const typeMap: Record<string, string[]> = {
            'TEXT': ['valueText'],
            'NUMBER': ['valueNumber'],
            'DATE': ['valueDate'],
            'DATETIME': ['valueDate'],
            'PERSON_REF': ['valuePersonId'],
            'ORG_REF': ['valueLeId', 'valueOrgId'],
            'DOCUMENT_REF': ['valueDocId'],
            'JSONB': ['valueJson']
        };

        const allowedSlots = typeMap[fieldDef.appDataType] || [];
        const providedSlots = [
            input.valueText ? 'valueText' : null,
            input.valueNumber ? 'valueNumber' : null,
            input.valueDate ? 'valueDate' : null,
            input.valueJson ? 'valueJson' : null,
            input.valuePersonId ? 'valuePersonId' : null,
            input.valueLeId ? 'valueLeId' : null,
            input.valueOrgId ? 'valueOrgId' : null,
            input.valueDocId ? 'valueDocId' : null
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
