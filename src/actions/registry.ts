"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { 
    initializeRegistryDomain, 
    deriveRegistryReferencesFromGleif, 
    RegistryEnrichmentService 
} from "@/domain/registry";
import { CanonicalRegistryMapper } from "@/services/kyc/normalization/CanonicalRegistryMapper";
import { KycWriteService } from "@/services/kyc/KycWriteService";

// Removed top-level initialization

export async function refreshLocalRegistryData(leId: string, force: boolean = true) {
    console.log("[refreshLocalRegistryData] START for leId:", leId, "force:", force);
    
    // Ensure domain is initialized inside the action context
    initializeRegistryDomain();

    try {
        // 1. Fetch Client LE
        const le = await prisma.clientLE.findUnique({
            where: { id: leId }
        });
        console.log("[refreshLocalRegistryData] Found LE:", le ? "YES" : "NO");

        if (!le) {
            return { success: false, error: "Legal Entity not found" };
        }

        if (!le.lei) {
            return { success: false, error: "No LEI found. Registry discovery requires an LEI." };
        }

        // 2. Discover/Update Registry References from current GLEIF data
        const attributes = (le.gleifData as any)?.attributes || (le.gleifData as any)?.data?.[0]?.attributes || le.gleifData;
        if (!attributes) {
            return { success: false, error: "No GLEIF data available to discover registry pointers." };
        }

        const refs = deriveRegistryReferencesFromGleif(le.id, le.lei, attributes);
        console.log("[refreshLocalRegistryData] Discovery found refs count:", refs.length);
        if (refs.length === 0) {
            console.log("[refreshLocalRegistryData] NO REFS FOUND");
            return { success: false, error: "No national registry pointers found in GLEIF data for this entity." };
        }

        // For simplicity in the "Refresh" button, we enrich the first one found or all.
        // Usually there is only one primary registration.
        let successCount = 0;
        let lastError = null;

        for (const refData of refs) {
            const reference = await prisma.registryReference.upsert({
                where: {
                    clientLEId_registryAuthorityId_localRegistrationNumber: {
                        clientLEId: leId,
                        registryAuthorityId: refData.registryAuthorityId!,
                        localRegistrationNumber: refData.localRegistrationNumber!
                    }
                },
                update: {},
                create: { ...refData as any }
            });

            console.log("[refreshLocalRegistryData] Triggering enrich for ref:", reference.id);
            const result = await RegistryEnrichmentService.enrich(reference.id, force);
                console.log("[refreshLocalRegistryData] Enrich result success:", result?.success);
                
                if (result?.success && result.record && result.evidenceId) {
                    console.log("[refreshLocalRegistryData] Propagating registry data to master fields...");
                    const kycWriteService = new KycWriteService();
                    const candidates = await CanonicalRegistryMapper.mapToCandidates(result.record, result.evidenceId);
                    
                    for (const candidate of candidates) {
                        // Apply as candidate (or update authoritative based on priority)
                        // Pass 'CLIENT_LE' since leId is a ClientLE ID
                        await kycWriteService.applyFieldCandidate(leId, candidate, undefined, 'CLIENT_LE');
                    }
                    console.log("[refreshLocalRegistryData] Propagation COMPLETE for", candidates.length, "fields");
                }

                if (result?.success) {
                successCount++;
            } else {
                lastError = result?.error;
                console.log("[refreshLocalRegistryData] Enrich failed with error:", lastError);
            }
        }

        console.log("[refreshLocalRegistryData] FINISHED. Total successCount:", successCount);
        if (successCount > 0) {
            revalidatePath(`/app/le/${leId}/sources/registry`);
            revalidatePath(`/app/le/${leId}/master`);
            return { success: true };
        } else {
            return { success: false, error: lastError || "Failed to refresh registry data" };
        }

    } catch (error: any) {
        console.error("Registry Refresh Error:", error);
        return { success: false, error: error.message || "Failed to refresh registry data" };
    }
}
