import prisma from "@/lib/prisma";
import { RegistryReference, RegistryFetch } from "@prisma/client";
import { RegistryAuthorityService } from "./RegistryAuthorityService";
import { RegistryConnectorFactory } from "./RegistryConnectorFactory";
import { CanonicalRegistryRecord } from "./types/CanonicalRegistryRecord";
import { EvidenceService } from "@/services/kyc/EvidenceService";
import { initializeRegistryDomain as initDomain } from "./index";

const evidenceService = new EvidenceService();

export class RegistryEnrichmentService {
    /**
     * Entry point for enriching a Legal Entity from a RegistryReference.
     */
    static async enrich(referenceId: string, force: boolean = false): Promise<{ success: boolean; record?: CanonicalRegistryRecord; evidenceId?: string; error?: string }> {
        console.log("[RegistryEnrichmentService.enrich] START for refId:", referenceId, "force:", force);
        // 1. Fetch the reference
        const reference = await prisma.registryReference.findUnique({
            where: { id: referenceId },
            include: { authority: true }
        });

        if (!reference) {
            console.log("[RegistryEnrichmentService.enrich] Reference NOT FOUND");
            return { success: false, error: "Reference not found" };
        }
        console.log("[RegistryEnrichmentService.enrich] Found ref for authority:", reference.registryAuthorityId);

        if (reference.status === "ENRICHED" && !force) {
            // Check staleness (e.g. 24 hours)
            const isStale = reference.updatedAt.getTime() < Date.now() - (24 * 60 * 60 * 1000);
            if (!isStale) {
                console.log("[RegistryEnrichmentService.enrich] Already enriched and not stale, skipping");
                return { success: false, error: "Already enriched (data is fresh)" };
            }
            console.log("[RegistryEnrichmentService.enrich] Data is stale, re-enriching...");
        }

        // 2. Find the connector
        console.log("[RegistryEnrichmentService.enrich] Searching for connector for:", reference.registryAuthorityId);
        let connector = RegistryConnectorFactory.getConnectorForAuthority(reference.registryAuthorityId);
        
        if (!connector) {
            // Lazy initialization check
            initDomain();
            connector = RegistryConnectorFactory.getConnectorForAuthority(reference.registryAuthorityId);
        }

        if (!connector) {
            console.log("[RegistryEnrichmentService.enrich] NO CONNECTOR FOUND");
            await prisma.registryReference.update({
                where: { id: referenceId },
                data: { status: "UNSUPPORTED" }
            });
            return { success: false, error: `No connector for authority ${reference.registryAuthorityId}` };
        }
        console.log("[RegistryEnrichmentService.enrich] Found connector:", connector.connectorKey);

        // 3. Create a fetch log (PENDING)
        const fetchLog = await prisma.registryFetch.create({
            data: {
                registryReferenceId: referenceId,
                connectorKey: connector.connectorKey,
                status: "PENDING"
            }
        });

        try {
            // 4. Update reference to PENDING
            console.log("[RegistryEnrichmentService.enrich] Fetching from connector...");
            await prisma.registryReference.update({
                where: { id: referenceId },
                data: { status: "PENDING" }
            });

            // 5. Execute fetch
            const record = await connector.fetch(reference);
            console.log("[RegistryEnrichmentService.enrich] Fetch result record exists:", !!record);

            // 6. Store as Evidence
            console.log("[RegistryEnrichmentService.enrich] Storing evidence...");
            const evidenceId = await evidenceService.normalizeEvidence(
                record.rawSourcePayload,
                record.sourceType as any,
                '1.0',
                'REGISTRY_FOLLOWUP'
            );
            console.log("[RegistryEnrichmentService.enrich] Evidence stored:", evidenceId);

            // 7. Record Success
            await prisma.registryFetch.update({
                where: { id: fetchLog.id },
                data: {
                    status: "SUCCESS",
                    completedAt: new Date(),
                    rawPayloadJson: record.rawSourcePayload,
                    normalizedJson: JSON.parse(JSON.stringify(record)), // ensure serializable
                    httpStatus: 200,
                    evidenceId
                }
            });

            // 8. Update reference to ENRICHED
            await prisma.registryReference.update({
                where: { id: referenceId },
                data: { status: "ENRICHED" }
            });

            // 9. Sync to ClientLE for backward compatibility with existing UI
            await prisma.clientLE.update({
                where: { id: reference.clientLEId },
                data: {
                    nationalRegistryData: JSON.parse(JSON.stringify(record)),
                    registryFetchedAt: new Date()
                }
            });

            return { success: true, record, evidenceId };
        } catch (error: any) {
            console.error(`[RegistryEnrichmentService] Fetch failed for ${referenceId}:`, error);

            // 8. Record Failure
            await prisma.registryFetch.update({
                where: { id: fetchLog.id },
                data: {
                    status: "FAILURE",
                    completedAt: new Date(),
                    errorMessage: error.message || String(error),
                    errorCode: error.code || "FETCH_ERROR"
                }
            });

            await prisma.registryReference.update({
                where: { id: referenceId },
                data: { status: "FAILED" }
            });

            return { success: false, error: error.message };
        }
    }
}
