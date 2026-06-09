"use server";

import { fetchGLEIFData } from "@/actions/gleif";
import { EvidenceService } from "@/services/kyc/EvidenceService";
import { mapGleifPayloadToFieldCandidates } from "@/services/kyc/normalization/GleifNormalizer";
import { KycWriteService } from "@/services/kyc/KycWriteService";
import { FieldProposal, ProvenanceSource } from "@/domain/kyc/types/ProposalTypes";
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getIdentity } from "@/lib/auth";
import { 
    initializeRegistryDomain, 
    deriveRegistryReferencesFromGleif, 
    RegistryEnrichmentService, 
    RegistryConnectorFactory
} from "@/domain/registry";
import { CanonicalRegistryMapper } from "@/services/kyc/normalization/CanonicalRegistryMapper";
import { RegistryMappingEngine } from "@/services/kyc/normalization/RegistryMappingEngine";

// Initialize registry domain (registers connectors)
initializeRegistryDomain();

const evidenceService = new EvidenceService();
const kycWriteService = new KycWriteService();

/**
 * Server Action: Refresh GLEIF Data and Generate Proposals
 * 1. Fetch latest GLEIF data for the LE's LEI
 * 2. Store as Evidence
 * 3. Normalize to Candidates
 * 4. Evaluate against current Master Record
 * 5. Return Proposals
 */
export async function refreshGleifProposals(legalEntityId: string): Promise<{ success: boolean; proposals?: FieldProposal[]; message?: string }> {
    try {
        // 1. Get Canonical LEI from KycStateService (Field 2)
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: legalEntityId },
            select: { legalEntityId: true, lei: true }
        });

        if (!clientLE) return { success: false, message: "Legal Entity not found" };

        let lei = clientLE.lei; // Fallback to denormalized legacy field

        if (clientLE.legalEntityId) {
            const derivedLei = await KycStateService.getAuthoritativeValue(
                { subjectLeId: clientLE.legalEntityId },
                2 // LEI Field No
            );
            if (derivedLei?.value) {
                lei = derivedLei.value;
            }
        }

        if (!lei) {
            return { success: false, message: "No LEI found for this entity." };
        }

        // 2. Fetch from GLEIF (using existing action logic)
        const gleifResult = await fetchGLEIFData(lei);
        if (!gleifResult.success) {
            return { success: false, message: gleifResult.error || "Failed to fetch GLEIF data" };
        }

        if (!gleifResult.data) {
            return { success: false, message: "No data returned from GLEIF" };
        }

        // 3. Store Evidence
        const evidenceId = await evidenceService.normalizeEvidence(
            gleifResult.data,
            'GLEIF',
            '2.0',
            'SYSTEM_REFRESH'
        );

        // 4. Normalize GLEIF
        let candidates = await mapGleifPayloadToFieldCandidates(gleifResult.data, evidenceId);

        // 5. Derive and Pursue National Registry References
        const attributes = (gleifResult.data as any)?.data?.attributes || (gleifResult.data as any)?.attributes || gleifResult.data;
        const registryRefs = deriveRegistryReferencesFromGleif(legalEntityId, lei, attributes);

        for (const refData of registryRefs) {
            // Ensure the RegistryAuthority row exists before touching the FK-constrained
            // RegistryReference row. bootstrapEntity does this; refreshGleifProposals must
            // mirror it, otherwise the upsert below fires a FK constraint error for any
            // authority that was never seeded (e.g. first-ever GLEIF refresh after import).
            const existingAuth = await prisma.registryAuthority.findUnique({
                where: { id: refData.registryAuthorityId! }
            });
            if (!existingAuth) {
                let authorityName = refData.registryAuthorityId!;
                let countryCode = 'UNKNOWN';
                try {
                    const raRes = await fetch(`https://api.gleif.org/api/v1/registration-authorities/${refData.registryAuthorityId!}`);
                    if (raRes.ok) {
                        const raJson = await raRes.json();
                        authorityName = raJson.data?.attributes?.internationalOrganizationName
                            || raJson.data?.attributes?.internationalName
                            || authorityName;
                        countryCode = raJson.data?.attributes?.jurisdiction || countryCode;
                    }
                } catch (e) {
                    console.warn(`[refreshGleifProposals] Failed to resolve authority name for ${refData.registryAuthorityId!}`);
                }
                await prisma.registryAuthority.upsert({
                    where: { id: refData.registryAuthorityId! },
                    update: {},
                    create: {
                        id: refData.registryAuthorityId!,
                        registryKey: refData.registryAuthorityId!,
                        name: authorityName,
                        countryCode,
                    }
                });
            }

            // Upsert the reference to prevent duplicates and track state
            const reference = await prisma.registryReference.upsert({
                where: {
                    clientLEId_registryAuthorityId_localRegistrationNumber: {
                        clientLEId: legalEntityId,
                        registryAuthorityId: refData.registryAuthorityId!,
                        localRegistrationNumber: refData.localRegistrationNumber!
                    }
                },
                update: {
                    sourceRecordId: lei,
                    derivedFromEvidenceId: evidenceId
                },
                create: {
                    ...refData as any,
                    derivedFromEvidenceId: evidenceId
                }
            });

            // Trigger enrichment
            const enrichment = await RegistryEnrichmentService.enrich(reference.id);
            
            if (enrichment.success && (enrichment as any).candidates) {
                // Use the new RA-scoped candidates from the Mapping Engine
                candidates = [...candidates, ...(enrichment as any).candidates];
            } else if (enrichment.success && enrichment.record && enrichment.evidenceId) {
                // Fallback for non-scoped connectors (legacy)
                const registryCandidates = await CanonicalRegistryMapper.mapToCandidates(enrichment.record, enrichment.evidenceId);
                candidates = [...candidates, ...registryCandidates];
            }

        }

        // 6. Evaluate Proposals
        const proposals: FieldProposal[] = [];

        for (const candidate of candidates) {
            // Use DB-backed lookup so dynamically created fields (fieldNo > 122) work.
            let def;
            try {
                def = await getMasterFieldDefinition(candidate.fieldNo);
            } catch {
                console.warn(
                    `[refreshGleifProposals] Skipping candidate: fieldNo ${candidate.fieldNo} not found in MasterFieldDefinition. ` +
                    `Ensure the field is active in the admin Master Data manager.`
                );
                continue;
            }

            // Pass 'CLIENT_LE' because legalEntityId here is a ClientLE.id
            const evaluation = await kycWriteService.evaluateFieldCandidate(legalEntityId, candidate, 'CLIENT_LE');

            proposals.push({
                fieldNo: candidate.fieldNo,
                fieldName: def.fieldName,
                table: (def as any).masterDataCategory?.displayName ?? null,
                column: def.modelField ?? null,
                current: evaluation.currentValue ? {
                    value: evaluation.currentValue,
                    source: (evaluation.currentSource as ProvenanceSource) || 'SYSTEM'
                } : undefined,
                proposed: {
                    value: candidate.value,
                    source: candidate.source as ProvenanceSource,
                    evidenceId: candidate.evidenceId || undefined,
                    timestamp: new Date().toISOString()
                },
                action: evaluation.action,
                reason: evaluation.reason
            });
        }

        // 6. Persist new data to the master cache for this Legal Entity
        await prisma.clientLE.update({
            where: { id: legalEntityId },
            data: {
                gleifData: gleifResult.data as any,
                gleifFetchedAt: new Date()
            }
        });

        revalidatePath(`/app/le/${legalEntityId}`);
        return { success: true, proposals };

    } catch (error: any) {
        console.error("refreshGleifProposals error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Server Action: Get Proposals from Cache (No external API call)
 * Uses the latest gleifData stored on the legal entity.
 */
export async function getGleifProposalsFromCache(legalEntityId: string): Promise<{ success: boolean; proposals?: FieldProposal[]; message?: string }> {
    try {
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: legalEntityId },
            select: { gleifData: true }
        });

        if (!clientLE || !clientLE.gleifData) {
            return { success: false, message: "No cached GLEIF data found for this entity." };
        }

        // 1. Store/Retrieve Evidence (to ensure mapping tracks back to a valid evidence ID)
        const evidenceId = await evidenceService.normalizeEvidence(
            clientLE.gleifData,
            'GLEIF',
            '2.0',
            'SYSTEM_CACHE_READ'
        );

        // 2. Normalize
        const candidates = await mapGleifPayloadToFieldCandidates(clientLE.gleifData, evidenceId);

        // 3. Evaluate Proposals
        const proposals: FieldProposal[] = [];

        for (const candidate of candidates) {
            // Use DB-backed lookup so dynamically created fields (fieldNo > 122) work.
            let def;
            try {
                def = await getMasterFieldDefinition(candidate.fieldNo);
            } catch {
                console.warn(
                    `[getGleifProposalsFromCache] Skipping candidate: fieldNo ${candidate.fieldNo} not found in MasterFieldDefinition. ` +
                    `Ensure the field is active in the admin Master Data manager.`
                );
                continue;
            }

            const evaluation = await kycWriteService.evaluateFieldCandidate(legalEntityId, candidate, 'CLIENT_LE');

            proposals.push({
                fieldNo: candidate.fieldNo,
                fieldName: def.fieldName,
                table: (def as any).masterDataCategory?.displayName ?? null,
                column: def.modelField ?? null,
                current: evaluation.currentValue ? {
                    value: evaluation.currentValue,
                    source: (evaluation.currentSource as ProvenanceSource) || 'SYSTEM'
                } : undefined,
                proposed: {
                    value: candidate.value,
                    source: 'GLEIF' as ProvenanceSource,
                    evidenceId: candidate.evidenceId || undefined,
                    timestamp: new Date().toISOString()
                },
                action: evaluation.action,
                reason: evaluation.reason
            });
        }

        return { success: true, proposals };
    } catch (error: any) {
        console.error("getGleifProposalsFromCache error:", error);
        return { success: false, message: error.message };
    }
}


/**
 * Server Action: Accept a Proposal
 * Re-applies the logic securely by fetching evidence and re-deriving to prevent client tampering.
 *
 * For REGISTRATION_AUTHORITY evidence: re-runs RegistryMappingEngine against the stored
 * EnrichmentRun (RA-scoped, respects sourceReference). Falls back safely for legacy evidence
 * records that pre-date the EnrichmentRun model.
 *
 * For GLEIF evidence: calls GleifNormalizer directly (unchanged).
 */
export async function acceptProposal(
    legalEntityId: string,
    fieldNo: number,
    evidenceId: string
): Promise<{ success: boolean; message?: string }> {
    try {
        // 1. Retrieve Evidence
        const evidence = await evidenceService.getEvidence(evidenceId);
        if (!evidence) return { success: false, message: "Evidence not found" };

        // 2. Normalize based on provider
        let candidates;
        if (evidence.provider === 'GLEIF') {
            // GLEIF path is unchanged — GleifNormalizer handles it directly.
            candidates = await mapGleifPayloadToFieldCandidates(evidence.payload, evidenceId);
        } else if (evidence.provider === 'REGISTRATION_AUTHORITY' || evidence.provider === 'COMPANIES_HOUSE') {
            // RA path: traverse RegistryFetch → EnrichmentRun → RegistryMappingEngine.
            // This ensures RA-specific sourceReference scoping is respected.
            const fetch = await (prisma as any).registryFetch?.findFirst({
                where: { evidenceId },
                include: { reference: { select: { clientLEId: true } } },
                orderBy: { requestedAt: 'desc' },
            });

            const run = fetch?.reference?.clientLEId
                ? await (prisma as any).enrichmentRun?.findFirst({
                    where: { legalEntityId: fetch.reference.clientLEId, status: 'SUCCESS' },
                    orderBy: { createdAt: 'desc' },
                })
                : null;

            if (!run) {
                // Safety net: legacy evidence records may not have an associated EnrichmentRun.
                // Return a clear error rather than falling back to the unscoped CanonicalRegistryMapper.
                console.warn(
                    `[acceptProposal] No EnrichmentRun found for RA evidence ${evidenceId}. ` +
                    `Trigger a manual registry refresh to create a new run, then re-try proposal acceptance.`
                );
                return {
                    success: false,
                    message: 'No enrichment run found for this evidence record. Please refresh registry data and try again.',
                };
            }

            candidates = await RegistryMappingEngine.mapEnrichmentRun(run.id);
        } else {
            return { success: false, message: `Provider ${evidence.provider} not supported for re-normalization.` };
        }

        // 3. Find Candidate
        const candidate = candidates.find((c: any) => c.fieldNo === fieldNo);
        if (!candidate) return { success: false, message: "Field candidate not found in evidence" };

        // 4. Apply
        const identity = await getIdentity();
        const userId = identity?.userId || undefined;

        // Pass 'CLIENT_LE' because legalEntityId is ClientLE ID
        const result = await kycWriteService.applyFieldCandidate(legalEntityId, candidate, userId, 'CLIENT_LE');

        if (result) {
            revalidatePath(`/app/le/${legalEntityId}`);
            return { success: true };
        } else {
            return { success: false, message: "Update denied by overwrite rules." };
        }

    } catch (error: any) {
        console.error("acceptProposal error:", error);
        return { success: false, message: error.message };
    }
}
