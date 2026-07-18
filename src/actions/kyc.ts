"use server";

import { revalidatePath } from "next/cache";
import { getIdentity } from "@/lib/auth";
import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";
import { KycWriteService } from "@/services/kyc/KycWriteService";
import { ModuleValidator } from "@/services/kyc/ModuleValidator";

// Types
export type KycActionState = {
    success: boolean;
    message?: string;
    errors?: Record<string, string[]>;
    data?: any;
};

// Services
const kycService = new KycWriteService();
const validator = new ModuleValidator();

/**
 * Authorization Helper
 * TODO: Define new Action enums for KYC specific granular permissions if needed.
 * For now, reusing LE_EDIT_MASTER_DATA as the baseline for all KYC writes.
 */
async function ensureKycAuthorization(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error("Unauthorized: No User");
    const { userId } = identity;

    // Fetch User with Memberships
    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: {
            organizationId: true,
            clientLEId: true,
            role: true
        }
    });

    const user: UserWithMemberships = {
        id: userId,
        memberships: memberships
    };

    // Reusing LE_EDIT_MASTER_DATA for now
    const allowed = await can(user, Action.LE_EDIT_MASTER_DATA, { clientLEId }, prisma);
    if (!allowed) throw new Error(`Unauthorized: Cannot edit KYC data for ${clientLEId}`);

    return { userId };
}

/**
 * GENERIC UPDATE FIELD ACTION
 * Updates a 1:1 profile field or specific field definition.
 */
export async function updateKycField(
    clientLEId: string,
    fieldNo: number,
    value: any,
    source: 'USER_INPUT' | 'GLEIF' | 'REGISTRATION_AUTHORITY' = 'USER_INPUT'
): Promise<KycActionState> {
    try {
        const { userId } = await ensureKycAuthorization(clientLEId);

        await kycService.updateField(clientLEId, fieldNo, value, {
            source,
            verifiedBy: userId
        });

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true };
    } catch (error: any) {
        console.error(`[updateKycField] Error updating field ${fieldNo}:`, error);
        return { success: false, message: error.message };
    }
}

/**
 * REPEATING ROW ACTIONS
 */
export async function createKycRow(
    clientLEId: string,
    modelName: string,
    data: Record<string, any>
): Promise<KycActionState> {
    try {
        const { userId } = await ensureKycAuthorization(clientLEId);

        // Generate default metadata for each field in the payload
        // This assumes every key in 'data' is a valid column that requires meta.
        // In a real implementation, we would validate against FieldDefinitions.
        const initialMeta: any = {};
        const timestamp = new Date().toISOString();

        Object.keys(data).forEach((key: any) => {
            // We use a placeholder field_no because we don't have the reverse mapping here yet.
            // Service layer validation might fail if field_no is strictly checked against the generic 'data' keys.
            // However, for 1:N rows, the service often takes 'initialData' and 'initialMeta'.
            // The service's 'createRepeatingRow' expects 'initialMeta' to be a Meta object.

            // For now, we defaulting source to USER_INPUT. 
            // The service layer might need to be lenient or we need a helper to lookup fieldNo by name.
            initialMeta[key] = {
                source: 'USER_INPUT',
                verified_by: userId,
                timestamp,
                // field_no: ??? -> We need to know the field number. 
                // Omitting field_no here might break the invariant if the service strictly checks it immediately?
                // The validateMetaForFields check in service layer requires field_no.
            };
        });

        // Use the service
        const id = await kycService.createRepeatingRow(
            clientLEId,
            modelName,
            data,
            initialMeta
        );

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true, data: { id } };

    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * SPECIALIZED ACTION: Create Authorized Trader
 * (Easier to handle specific mapping here than generic reflection)
 */
export async function createAuthorizedTrader(
    clientLEId: string,
    payload: { fullName: string; email: string; jobTitle?: string }
): Promise<KycActionState> {
    try {
        const { userId } = await ensureKycAuthorization(clientLEId);

        // Map to Field Nos: Full Name (96), Email (97), Job Title (98)
        const initialMeta = {
            fullName: { field_no: 96, source: 'USER_INPUT', verified_by: userId, timestamp: new Date().toISOString() },
            email: { field_no: 97, source: 'USER_INPUT', verified_by: userId, timestamp: new Date().toISOString() },
            ...(payload.jobTitle && {
                jobTitle: { field_no: 98, source: 'USER_INPUT', verified_by: userId, timestamp: new Date().toISOString() }
            })
        };

        const id = await kycService.createRepeatingRow(
            clientLEId,
            'AuthorizedTrader',
            payload,
            initialMeta as any
        );

        revalidatePath(`/app/le/${clientLEId}`);
        return { success: true, data: { id } };
    } catch (error: any) {
        console.error("Failed to create trader:", error);
        return { success: false, message: error.message };
    }
}

/**
 * MODULE VALIDATION
 */
export async function validateKycModule(clientLEId: string, moduleName: string): Promise<KycActionState> {
    try {
        await ensureKycAuthorization(clientLEId); // Read permission implied by Edit? Or distinct?

        const result = await validator.validateModule(clientLEId, moduleName);

        if (!result.valid) {
            // Transform array of strings to generic error object for UI
            return {
                success: false,
                message: "Validation Failed",
                errors: { form: result.errors }
            };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

/**
 * DOCUMENT UPLOAD
 */
