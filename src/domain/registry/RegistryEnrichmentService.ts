import prisma from "@/lib/prisma";
import { RegistryReference, RegistryFetch, SourceType, PayloadSubtype } from "@prisma/client";
import { RegistryAuthorityService } from "./RegistryAuthorityService";
import { RegistryConnectorFactory } from "./RegistryConnectorFactory";
import { CanonicalRegistryRecord } from "./types/CanonicalRegistryRecord";
import { EvidenceService } from "@/services/kyc/EvidenceService";
import { initializeRegistryDomain as initDomain } from "./index";
import { RegistryMappingEngine } from "@/services/kyc/normalization/RegistryMappingEngine";

const evidenceService = new EvidenceService();

export class RegistryEnrichmentService {
    /**
     * Entry point for enriching a Legal Entity from a RegistryReference.
     */
    static async enrich(referenceId: string, options: { forceRefresh?: boolean, autoApply?: boolean, initiatedBy?: string } = {}): Promise<{ success: boolean; record?: CanonicalRegistryRecord; evidenceId?: string; error?: string }> {
        const { forceRefresh = false, autoApply = false, initiatedBy = "SYSTEM" } = options;
        console.log("[RegistryEnrichmentService.enrich] START for refId:", referenceId, "options:", options);
        
        // 1. Fetch the reference and its ClientLE -> LegalEntity bridge
        const reference = await prisma.registryReference.findUnique({
            where: { id: referenceId },
            include: { 
                authority: true,
                clientLE: { select: { id: true, legalEntityId: true } }
            }
        });

        if (!reference) {
            console.log("[RegistryEnrichmentService.enrich] Reference NOT FOUND");
            return { success: false, error: "Reference not found" };
        }

        const legalEntityId = reference.clientLEId;
        if (!legalEntityId) {
            return { success: false, error: "Reference has no linked ClientLE. Enrichment aborted." };
        }

        console.log("[RegistryEnrichmentService.enrich] Found ref for authority:", reference.registryAuthorityId);

        if (reference.status === "ENRICHED" && !forceRefresh) {
            // Check staleness (e.g. 24 hours)
            const isStale = reference.updatedAt.getTime() < Date.now() - (24 * 60 * 60 * 1000);
            if (!isStale) {
                console.log("[RegistryEnrichmentService.enrich] Already enriched and not stale, skipping");
                return { success: false, error: "Already enriched (data is fresh)" };
            }
            console.log("[RegistryEnrichmentService.enrich] Data is stale, re-enriching...");
        }

        // 2. Find the connector
        let connector = RegistryConnectorFactory.getConnectorForAuthority(reference.registryAuthorityId);
        if (!connector) {
            initDomain();
            connector = RegistryConnectorFactory.getConnectorForAuthority(reference.registryAuthorityId);
        }

        if (!connector) {
            await prisma.registryReference.update({
                where: { id: referenceId },
                data: { status: "UNSUPPORTED", lastSyncStatus: "FAILED", lastSyncAttemptAt: new Date() }
            });
            return { success: false, error: `No connector for authority ${reference.registryAuthorityId}` };
        }

        // 3. Create EnrichmentRun tracking (Defensive check for model existence)
        let run: any = null;
        if ((prisma as any).enrichmentRun) {
            run = await (prisma as any).enrichmentRun.create({
                data: {
                    legalEntityId,
                    initiatedBy,
                    triggerType: forceRefresh ? "MANUAL_REFRESH" : "LEI_SET",
                    registrationAuthorityId: reference.registryAuthorityId,
                    status: "PENDING"
                }
            });
        }


        // 4. Create legacy fetch log for backward compatibility
        const fetchLog = await prisma.registryFetch.create({
            data: {
                registryReferenceId: referenceId,
                connectorKey: connector.connectorKey,
                status: "PENDING"
            }
        });

        try {
            // 5. Update reference to PENDING
            await prisma.registryReference.update({
                where: { id: referenceId },
                data: { status: "PENDING", lastSyncAttemptAt: new Date(), lastSyncStatus: "PENDING" }
            });

            // 6. Execute fetch
            const record = await connector.fetch(reference);
            console.log("[RegistryEnrichmentService.enrich] Fetch successful");

            // 7. Store IMMUTABLE Raw Payloads (Layer A)
            // If the connector returned structured payloads, we store them as separate rows
            const rawPayloads = record.rawSourcePayload;
            if (run && (prisma as any).registrySourcePayload && rawPayloads && typeof rawPayloads === 'object' && !Array.isArray(rawPayloads)) {
                // De-duplicate payloads: mark old ones for this LE as not latest
                await (prisma as any).registrySourcePayload.updateMany({
                    where: { legalEntityId, sourceType: SourceType.REGISTRATION_AUTHORITY, isLatest: true },
                    data: { isLatest: false }
                });

                for (const [subtype, payload] of Object.entries(rawPayloads)) {
                    await (prisma as any).registrySourcePayload.create({
                        data: {
                            legalEntityId,
                            enrichmentRunId: run.id,
                            sourceType: SourceType.REGISTRATION_AUTHORITY,
                            payloadSubtype: subtype as any,
                            sourceReference: reference.registryAuthorityId,
                            externalId: reference.localRegistrationNumber,
                            payload: payload as any,
                            isLatest: true
                        }
                    });
                }
            }


            // 8. Generate Thin Baseline Extract (Layer B)
            if (run && (prisma as any).registryBaselineExtract) {
                await (prisma as any).registryBaselineExtract.create({
                    data: {
                        legalEntityId,
                        enrichmentRunId: run.id,
                        legalName: record.entityName,
                        registrationNumber: reference.localRegistrationNumber,
                        countryCode: record.registeredAddress?.country || reference.authority.countryCode,
                        registrationAuthorityId: reference.registryAuthorityId,
                        entityStatus: record.entityStatus,
                        registeredAddress: record.registeredAddress as any,
                        incorporationDate: record.incorporationDate ? new Date(record.incorporationDate) : null,
                    }
                });
            }


            // 9. Store as Evidence (Legacy Service)
            const evidenceId = await evidenceService.normalizeEvidence(
                record.rawSourcePayload,
                record.sourceType as any,
                '2.0', // New version indicator
                initiatedBy
            );

            // 10. Record Success on Run and Fetch logs
            if (run && (prisma as any).enrichmentRun) {
                await (prisma as any).enrichmentRun.update({
                    where: { id: run.id },
                    data: { status: "SUCCESS", completedAt: new Date() }
                });
            }


            await prisma.registryFetch.update({
                where: { id: fetchLog.id },
                data: {
                    status: "SUCCESS",
                    completedAt: new Date(),
                    rawPayloadJson: record.rawSourcePayload,
                    normalizedJson: JSON.parse(JSON.stringify(record)),
                    httpStatus: 200,
                    evidenceId
                }
            });

            // 11. Update states
            await prisma.registryReference.update({
                where: { id: referenceId },
                data: { status: "ENRICHED", lastSyncSucceededAt: new Date(), lastSyncStatus: "SUCCESS" }
            });


            // Sync to ClientLE for backward compatibility with existing UI
            // We re-merge the normalized record with raw payloads so the UI sees everything
            const mergedLegacyPayload = {
                ...JSON.parse(JSON.stringify(record)), // Include normalized fields (entityName, etc.)
                ...(rawPayloads?.COMPANY_PROFILE || {}), // Include raw CH fields (company_name, etc.)
                officers: rawPayloads?.OFFICERS || record.officers || [],
                pscs: rawPayloads?.PSC || record.pscs || []
            };

            await prisma.clientLE.update({
                where: { id: reference.clientLEId },
                data: {
                    nationalRegistryData: JSON.parse(JSON.stringify(mergedLegacyPayload)),
                    registryFetchedAt: new Date()
                }
            });


            // 12. RUN MAPPING ENGINE (New Pipeline)
            let candidates: any[] = [];
            if (run) {
                console.log("[RegistryEnrichmentService.enrich] Running Mapping Engine...");
                try {
                    candidates = await RegistryMappingEngine.mapEnrichmentRun(run.id);
                    console.log(`[RegistryEnrichmentService.enrich] Generated ${candidates.length} candidates.`);
                } catch (e) {
                    console.error("[RegistryEnrichmentService.enrich] Mapping Engine failed:", e);
                }
            }

            return { success: true, record, evidenceId, candidates };
        } catch (error: any) {

            console.error(`[RegistryEnrichmentService] Fetch failed:`, error);

            if (run && (prisma as any).enrichmentRun) {
                await (prisma as any).enrichmentRun.update({
                    where: { id: run.id },
                    data: { status: "FAILURE", completedAt: new Date(), summary: { error: error.message } }
                });
            }

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
                data: { status: "FAILED", lastSyncStatus: "FAILED" }
            });

            return { success: false, error: error.message };
        }
    }
}

