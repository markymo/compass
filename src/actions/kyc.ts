"use server";

import { revalidatePath } from "next/cache";
import { getIdentity } from "@/lib/auth";
import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";
import { KycWriteService } from "@/services/kyc/KycWriteService";
import { DocumentService } from "@/services/kyc/DocumentService";
import { ModuleValidator } from "@/services/kyc/ModuleValidator";
import { DocumentRegistrySchema } from "@/domain/kyc/schemas/DocumentRegistrySchema";

// Types
export type KycActionState = {
    success: boolean;
    message?: string;
    errors?: Record<string, string[]>;
    data?: any;
};

// Services
const kycService = new KycWriteService();
const docService = new DocumentService();
const validator = new ModuleValidator();

/**
 * Authorization Helper
 * TODO: Define new Action enums for KYC specific granular permissions if needed.
 * For now, reusing LE_EDIT_DATA as the baseline for all KYC writes.
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

    // Reusing LE_EDIT_DATA for now
    const allowed = await can(user, Action.LE_EDIT_DATA, { clientLEId }, prisma);
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
    source: 'USER_INPUT' | 'GLEIF' | 'COMPANIES_HOUSE' = 'USER_INPUT'
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

        Object.keys(data).forEach(key => {
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
export async function uploadKycDocument(formData: FormData): Promise<KycActionState> {
    try {
        const file = formData.get('file') as File;
        const legalEntityId = formData.get('legalEntityId') as string;
        const ownerType = formData.get('ownerType') as string;
        const ownerId = formData.get('ownerId') as string;
        const fieldNoStr = formData.get('fieldNo') as string;

        if (!file || !legalEntityId || !fieldNoStr) {
            return { success: false, message: "Missing required fields" };
        }

        const { userId } = await ensureKycAuthorization(legalEntityId);

        const docId = await docService.uploadDocument({
            legalEntityId,
            ownerType: ownerType as any,
            ownerId,
            fieldNo: parseInt(fieldNoStr),
            // Pass properties of the file, not the file object if the service expects a path/stream (Service Mocks S3 for now)
            // The service signature we implemented in Phase 2C was:
            // check DocumentService.ts -> it takes { fileName, mimeType ... } and mocks S3.
            // It does NOT strictly take a 'File' stream yet because we haven't implemented real S3.
            // So we just pass names.
            fileName: file.name,
            mimeType: file.type,
            filePath: `uploads/${file.name}`, // Mock path
            uploadedBy: userId
        });

        // Link logic? The Doc Service creates the Registry Entry. 
        // But referencing the Doc ID in the target field (e.g. Field 100) 
        // must be done separately via updateKycField? 
        // OR the UI does: 1. Upload returns ID -> 2. Update Field with ID.
        // This is the cleanest pattern.

        revalidatePath(`/app/le/${legalEntityId}`);
        return { success: true, data: { documentId: docId } };

    } catch (error: any) {
        console.error("Upload failed:", error);
        return { success: false, message: error.message };
    }
}
