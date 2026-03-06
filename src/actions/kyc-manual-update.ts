"use server";

import { FieldClaimService } from "@/lib/kyc/FieldClaimService";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMasterFieldDefinition, listAllMasterFields } from "@/services/masterData/definitionService";
import { SourceType } from "@prisma/client";

// KycWriteService is deprecated in favor of FieldClaimService

/**
 * Manually updates a field, overriding any automated feeds.
 * Sets source to USER_INPUT.
 */
export async function updateFieldManually(
    clientLEId: string,
    fieldNo: number,
    value: any,
    reason: string,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
): Promise<{ success: boolean; message?: string }> {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;

        if (!userId) {
            return { success: false, message: "Authentication required for manual updates." };
        }
        // Reason is now optional

        // 1. Resolve Subject and Scope
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId }
        });
        const subjectLeId = clientLE?.legalEntityId;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        if (!subjectLeId) {
            return { success: false, message: "Could not resolve LegalEntity subject." };
        }

        // 2. Map value to correct slot based on FieldDefinition
        const def = await getMasterFieldDefinition(fieldNo);
        const claimInput: any = {
            fieldNo,
            subjectLeId,
            ownerScopeId,
            sourceType: SourceType.USER_INPUT,
            sourceReference: reason,
            collectionId: def.isMultiValue ? (def.category || 'GENERAL') : undefined,
            instanceId: rowId // For multi-value, rowId is the stable instance key
        };

        // Assign value to the correct slot
        switch (def.appDataType) {
            case 'TEXT': claimInput.valueText = value; break;
            case 'NUMBER': claimInput.valueNumber = value; break;
            case 'DATE':
            case 'DATETIME': claimInput.valueDate = new Date(value); break;
            case 'PERSON_REF': claimInput.valuePersonId = value; break;
            case 'ORG_REF': claimInput.valueLeId = value; break;
            case 'DOCUMENT_REF': claimInput.valueText = value; break; // Manual edits store as text; valueDocId requires valid FK
            case 'JSONB': claimInput.valueJson = value; break;
        }

        const claim = await FieldClaimService.assertClaim({
            ...claimInput,
            verifiedByUserId: userId,
            status: SourceType.USER_INPUT === SourceType.USER_INPUT ? 'VERIFIED' : 'ASSERTED' // manual updates are verified
        });

        if (claim) {
            revalidatePath(`/app/le/${clientLEId}`);
            return { success: true };
        } else {
            return { success: false, message: "Update failed." };
        }
    } catch (error: any) {
        console.error("updateFieldManually error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Alias for updateFieldManually to match frontend usage.
 * ROUTING LOGIC: Checks if 'fieldNo' refers to a Standard Field or Custom Field.
 */
export async function applyManualOverride(
    leId: string,
    fieldNo: string | number, // Frontend passes string sometimes?
    value: any,
    reason: string,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
) {
    // Get real userId from session
    const identity = await getIdentity();
    const userId = identity?.userId || "SYSTEM_USER";

    const num = Number(fieldNo);

    // 1. Try Standard Field Update
    // We check if it's a valid number AND exists in definitions.
    if (!isNaN(num) && num > 0) {
        try {
            await getMasterFieldDefinition(num);
            return updateFieldManually(leId, num, value, reason, rowId, entityType);
        } catch (e) {
            // Not a standard field, fall through to custom
        }
    }

    // 2. Fallback to Custom Field Update
    // If not a standard field ID, assume it's a Custom Field Key.
    return updateCustomFieldManually(leId, String(fieldNo), value, reason);
}

/**
 * Reverts/Applies a specific candidate value.
 * This effectively "Accepts" a candidate.
 */
export async function applyCandidate(
    clientLEId: string,
    candidatePayload: any,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
): Promise<{ success: boolean; message?: string }> {
    try {
        // In the new architecture, applying a candidate means asserting it as a USER_INPUT claim
        // This is a simplified version:
        return await updateFieldManually(
            clientLEId,
            candidatePayload.fieldNo,
            candidatePayload.value,
            "Accepted candidate value",
            rowId,
            entityType
        );
    } catch (error: any) {
        console.error("applyCandidate error:", error);
        return { success: false, message: error.message };
    }
}

export async function applyFieldCandidate(
    leId: string,
    candidate: any
) {
    return applyCandidate(leId, candidate);
}
export async function updateCustomFieldManually(
    clientLEId: string,
    fieldKey: string,
    value: any,
    reason: string
) {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;

        if (!userId) {
            return { success: false, message: "Authentication required for custom field updates." };
        }
        const le = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        if (!le) return { success: false, message: "LE not found" };

        const currentData = (le.customData as Record<string, any>) || {};

        // Update structure
        const newData = {
            ...currentData,
            [fieldKey]: {
                value: value,
                source: "USER_INPUT",
                timestamp: new Date().toISOString(),
                updatedBy: userId,
                reason: reason
            }
        };

        await prisma.clientLE.update({
            where: { id: clientLEId },
            data: { customData: newData }
        });

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true };

    } catch (e: any) {
        console.error("Failed to update custom field:", e);
        return { success: false, message: e.message };
    }
}

/**
 * Adds a new value to a multi-value field.
 * Generates a fresh instanceId and asserts a real value (not a placeholder).
 */
export async function addMultiValueEntry(
    clientLEId: string,
    fieldNo: number,
    value: any,
    reason?: string
): Promise<{ success: boolean; message?: string; claimId?: string }> {
    try {
        const def = await getMasterFieldDefinition(fieldNo);
        if (!def.isMultiValue) return { success: false, message: "Field is not multi-value" };

        if (!value || (typeof value === 'string' && !value.trim())) {
            return { success: false, message: "A value is required" };
        }

        const instanceId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const result = await updateFieldManually(
            clientLEId,
            fieldNo,
            typeof value === 'string' ? value.trim() : value,
            reason || "Added new entry",
            instanceId,
            'CLIENT_LE'
        );

        if (result.success) {
            return { success: true, claimId: instanceId };
        }
        return result;
    } catch (e: any) {
        console.error("addMultiValueEntry error:", e);
        return { success: false, message: e.message };
    }
}

/**
 * Removes a value from a multi-value field by emitting a tombstone claim.
 * The value is soft-deleted — it won't appear in getAuthoritativeCollection results.
 */
export async function removeMultiValueEntry(
    clientLEId: string,
    fieldNo: number,
    claimId: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const identity = await getIdentity();
        const userId = identity?.userId;
        if (!userId) {
            return { success: false, message: "Authentication required." };
        }

        const def = await getMasterFieldDefinition(fieldNo);
        if (!def.isMultiValue) return { success: false, message: "Field is not multi-value" };

        // Look up the claim to get collectionId and instanceId
        const claim = await prisma.fieldClaim.findUnique({
            where: { id: claimId }
        });

        if (!claim) {
            return { success: false, message: "Claim not found" };
        }

        if (!claim.instanceId) {
            return { success: false, message: "Cannot remove: claim has no instanceId" };
        }

        // Resolve subject
        const clientLE = await prisma.clientLE.findUnique({ where: { id: clientLEId } });
        const subjectLeId = clientLE?.legalEntityId;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        if (!subjectLeId) {
            return { success: false, message: "Could not resolve subject." };
        }

        // Emit tombstone
        await FieldClaimService.emitTombstone(
            { subjectLeId },
            fieldNo,
            claim.collectionId || def.category || 'GENERAL',
            claim.instanceId,
            ownerScopeId
        );

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true };
    } catch (e: any) {
        console.error("removeMultiValueEntry error:", e);
        return { success: false, message: e.message };
    }
}

export async function applyBulkOverride(
    clientLEId: string,
    modelName: string,
    updates: Record<string, any>,
    reason: string,
    rowId?: string,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
) {
    const identity = await getIdentity();
    const userId = identity?.userId || "SYSTEM_USER";
    try {
        const allFields = await listAllMasterFields();
        const fieldNos = allFields
            .filter((f: any) => f.category === modelName)
            .map((f: any) => f.fieldNo);

        for (const [fieldName, value] of Object.entries(updates)) {
            const def = allFields.find((f: any) => f.category === modelName && f.fieldName === fieldName);
            if (def) {
                await updateFieldManually(clientLEId, def.fieldNo, value, reason, rowId, entityType);
            }
        }

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true };
    } catch (error: any) {
        console.error("applyBulkOverride error:", error);
        return { success: false, message: error.message };
    }
}
