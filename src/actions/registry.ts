"use server";

import { revalidatePath } from "next/cache";
import { LegalEntityEnrichmentService } from "@/domain/registry";

/**
 * Legacy support: discovers references and enriches all of them.
 * Returns warnings[] for any GLEIF candidates that were skipped due to
 * mapping misconfigurations — so the UI can surface them as toast.warning.
 */
export async function refreshLocalRegistryData(leId: string, force: boolean = true) {
    console.log("[refreshLocalRegistryData] START for leId:", leId, "force:", force);
    try {
        const result = await LegalEntityEnrichmentService.bootstrapEntity(leId);

        if (result.success) {
            revalidatePath(`/app/le/${leId}/sources/registry`);
            revalidatePath(`/app/le/${leId}/master`);
            return { success: true, warnings: result.warnings };
        } else {
            return {
                success: false,
                error: result.error || "Failed to refresh registry data",
                warnings: result.warnings,
            };
        }
    } catch (error: any) {
        console.error("Registry Refresh Error:", error);
        return { success: false, error: error.message || "Failed to refresh registry data" };
    }
}

/**
 * Targeted refresh for a specific registry reference.
 * Returns warnings[] so the UI can surface any candidate-level failures.
 */
export async function refreshRegistryReferenceAction(leId: string, referenceId: string) {
    console.log("[refreshRegistryReferenceAction] START for referenceId:", referenceId);
    try {
        const result = await LegalEntityEnrichmentService.refreshRegistryClaims(referenceId, {
            autoApply: true,
            initiatedBy: 'MANUAL_UI_REFRESH',
        });

        if (result?.success) {
            revalidatePath(`/app/le/${leId}/sources/registry`);
            revalidatePath(`/app/le/${leId}/master`);
            return { success: true, warnings: (result as any).warnings };
        } else {
            return {
                success: false,
                error: result?.error || "Failed to refresh registry data",
                warnings: (result as any)?.warnings,
            };
        }
    } catch (error: any) {
        console.error("Registry Refresh Error:", error);
        return { success: false, error: error.message || "Failed to refresh registry data" };
    }
}
