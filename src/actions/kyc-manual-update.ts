"use server";

import { KycWriteService } from "@/services/kyc/KycWriteService";
import { revalidatePath } from "next/cache";

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
 * Alias for updateFieldManually to match frontend usage
 */
export async function applyManualOverride(
    leId: string,
    fieldNo: string | number, // Frontend passes string sometimes?
    value: any,
    reason: string
) {
    // Basic userId for now (TODO: get from session)
    const userId = "SYSTEM_USER";

    return updateFieldManually(leId, Number(fieldNo), value, reason, userId);
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
