"use server";

import { KycWriteService } from "@/services/kyc/KycWriteService";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isValidFieldNo } from "@/domain/kyc/FieldDefinitions";

const kycWriteService = new KycWriteService();

/**
 * Manually updates a field, overriding any automated feeds.
 * Emits a MasterDataEvent and sets source to USER_INPUT.
 */
export async function updateFieldManually(
    legalEntityId: string,
    fieldNo: number,
    value: any,
    reason: string,
    userId: string
): Promise<{ success: boolean; message?: string }> {
    try {
        if (!reason) {
            return { success: false, message: "A reason is required for manual overrides." };
        }

        const success = await kycWriteService.applyManualOverride(
            legalEntityId,
            fieldNo,
            value,
            reason,
            userId
        );

        if (success) {
            revalidatePath(`/app/le/${legalEntityId}`);
            // Also revalidate the inspector view if it's a separate route?
            // Usually revalidating the page covers it.
            return { success: true };
        } else {
            return { success: false, message: "Update failed. Check overwrite rules." };
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
    reason: string
) {
    // Basic userId for now (TODO: get from session)
    const userId = "SYSTEM_USER";

    const num = Number(fieldNo);

    // 1. Try Standard Field Update
    // We check if it's a valid number AND exists in definitions.
    // Logging for debug:
    console.log(`[applyManualOverride] Input: ${fieldNo}, Parsed: ${num}, IsValid: ${isValidFieldNo(num)}`);

    if (!isNaN(num) && num > 0 && isValidFieldNo(num)) {
        return updateFieldManually(leId, num, value, reason, userId);
    }

    // 2. Fallback to Custom Field Update
    // If not a standard field ID, assume it's a Custom Field Key.
    return updateCustomFieldManually(leId, String(fieldNo), value, reason, userId);
}

/**
 * Reverts/Applies a specific candidate value.
 * This effectively "Accepts" a candidate.
 */
export async function applyCandidate(
    legalEntityId: string,
    candidatePayload: any,
    userId: string
): Promise<{ success: boolean; message?: string }> {
    try {
        // candidatePayload should be a FieldCandidate object
        // We might want to validate it here
        const success = await kycWriteService.applyCandidate(
            legalEntityId,
            candidatePayload,
            userId
        );

        if (success) {
            revalidatePath(`/app/le/${legalEntityId}`);
            return { success: true };
        } else {
            return { success: false, message: "Update denied by overwrite rules." };
        }
    } catch (error: any) {
        console.error("applyCandidate error:", error);
        return { success: false, message: error.message };
    }
}

export async function applyFieldCandidate(
    leId: string,
    candidate: any,
    userId: string = "SYSTEM"
) {
    return applyCandidate(leId, candidate, userId);
}
export async function updateCustomFieldManually(
    clientLEId: string,
    fieldKey: string,
    value: any,
    reason: string,
    userId: string
) {
    try {
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
