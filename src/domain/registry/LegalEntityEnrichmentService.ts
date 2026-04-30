import prisma from "@/lib/prisma";
import { fetchGLEIFData } from "@/actions/gleif";
import { EvidenceService } from "@/services/kyc/EvidenceService";
import { mapGleifPayloadToFieldCandidates } from "@/services/kyc/normalization/GleifNormalizer";
import { KycWriteService } from "@/services/kyc/KycWriteService";
import {
    initializeRegistryDomain,
    deriveRegistryReferencesFromGleif,
    RegistryEnrichmentService
} from "@/domain/registry";
import { CanonicalRegistryMapper } from "@/services/kyc/normalization/CanonicalRegistryMapper";

const evidenceService = new EvidenceService();
const kycWriteService = new KycWriteService();

export class LegalEntityEnrichmentService {

    /**
     * Bootstrap mode: GLEIF + registry chain.
     * Orchestrates the fetching of GLEIF data, extraction into field candidates,
     * discovery of National Registry pointers, enrichment from those registries,
     * and finally asserts those candidates as actual FieldClaim records.
     */
    static async bootstrapEntity(legalEntityId: string) {
        console.log(`[LegalEntityEnrichmentService.bootstrapEntity] Starting for LE: ${legalEntityId}`);
        initializeRegistryDomain();

        // 1. Fetch ClientLE
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: legalEntityId },
            select: { lei: true, gleifData: true, gleifFetchedAt: true }
        });

        if (!clientLE || !clientLE.lei) {
            console.log(`[LegalEntityEnrichmentService.bootstrapEntity] Skipping: No LEI or LE found.`);
            return { success: false, error: "Legal Entity or LEI not found." };
        }

        let gleifData = clientLE.gleifData as any;

        // If no gleif data locally, try fetching
        if (!gleifData) {
            const gleifResult = await fetchGLEIFData(clientLE.lei);
            if (gleifResult.success && gleifResult.data) {
                gleifData = gleifResult.data;
                await prisma.clientLE.update({
                    where: { id: legalEntityId },
                    data: {
                        gleifData: gleifData,
                        gleifFetchedAt: new Date()
                    }
                });
            } else {
                return { success: false, error: "Failed to fetch GLEIF data for bootstrap." };
            }
        }

        // 2. Persist Evidence from GLEIF and Apply Candidates
        try {
            const evidenceId = await evidenceService.normalizeEvidence(
                gleifData,
                'GLEIF',
                '2.0',
                'SYSTEM_BOOTSTRAP'
            );

            const gleifCandidates = await mapGleifPayloadToFieldCandidates(gleifData, evidenceId);
            for (const candidate of gleifCandidates) {
                await kycWriteService.applyFieldCandidate(legalEntityId, candidate, undefined, 'CLIENT_LE');
            }

            // 3. Derive National Registry References and Enrich
            const attributes = gleifData?.attributes || gleifData?.data?.[0]?.attributes || gleifData;
            const registryRefs = deriveRegistryReferencesFromGleif(legalEntityId, clientLE.lei, attributes);

            for (const refData of registryRefs) {
                // Ensure authority exists first
                const existingAuth = await prisma.registryAuthority.findUnique({
                    where: { id: refData.registryAuthorityId! }
                });

                let authorityName = existingAuth?.name || refData.registryAuthorityId!;
                let countryCode = existingAuth?.countryCode || "UNKNOWN";

                // Retroactively fetch name if it's currently just a placeholder ID
                if (!existingAuth || existingAuth.name === existingAuth.id) {
                    try {
                        console.log(`[LegalEntityEnrichmentService] Resolving name for authority: ${refData.registryAuthorityId!}`);
                        const raRes = await fetch(`https://api.gleif.org/api/v1/registration-authorities/${refData.registryAuthorityId!}`);
                        if (raRes.ok) {
                            const raJson = await raRes.json();
                            authorityName = raJson.data?.attributes?.internationalOrganizationName 
                                || raJson.data?.attributes?.internationalName 
                                || authorityName;
                            countryCode = raJson.data?.attributes?.jurisdiction || countryCode;
                        }
                    } catch (e) {
                        console.warn(`[LegalEntityEnrichmentService] Failed to resolve authority name for ${refData.registryAuthorityId!}`);
                    }
                }

                await prisma.registryAuthority.upsert({
                    where: { id: refData.registryAuthorityId! },
                    update: {},
                    create: {
                        id: refData.registryAuthorityId!,
                        registryKey: refData.registryAuthorityId!,
                        name: authorityName,
                        countryCode: countryCode
                    }
                });

                const reference = await prisma.registryReference.upsert({
                    where: {
                        clientLEId_registryAuthorityId_localRegistrationNumber: {
                            clientLEId: legalEntityId,
                            registryAuthorityId: refData.registryAuthorityId!,
                            localRegistrationNumber: refData.localRegistrationNumber!
                        }
                    },
                    update: {
                        sourceRecordId: clientLE.lei,
                        derivedFromEvidenceId: evidenceId
                    },
                    create: {
                        ...refData as any,
                        derivedFromEvidenceId: evidenceId
                    }
                });

                // Auto-apply happens as part of this process
                await this.refreshRegistryClaims(reference.id, { autoApply: true, initiatedBy: 'CREATE_CLIENT_LE' });
            }

            return { success: true };
        } catch (error: any) {
            console.error(`[LegalEntityEnrichmentService.bootstrapEntity] Error:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Manual registry refresh mode: 
     * Refresh from already-known references, only falling back to GLEIF discovery if needed.
     */
    static async refreshRegistryClaims(referenceId: string, options: { autoApply: boolean, initiatedBy: string }) {
        console.log(`[LegalEntityEnrichmentService.refreshRegistryClaims] Starting ref: ${referenceId}, options:`, options);
        initializeRegistryDomain();

        const reference = await prisma.registryReference.findUnique({
            where: { id: referenceId }
        });

        if (!reference) return { success: false, error: "Registry reference not found." };

        const { autoApply } = options;

        const result = await RegistryEnrichmentService.enrich(referenceId, { forceRefresh: true, autoApply });

        if (result?.success && result.record && result.evidenceId && autoApply) {
            console.log(`[LegalEntityEnrichmentService.refreshRegistryClaims] Auto-applying claims...`);
            
            // 1. Generate Legacy Candidates
            const legacyCandidates = await CanonicalRegistryMapper.mapToCandidates(result.record, result.evidenceId);
            
            // 2. Extract New Baseline/RA Mapped Candidates
            const newCandidates = result.candidates || [];
            
            // 3. Merge candidates (New Engine candidates take precedence over Legacy ones if there's a collision)
            const allCandidates = [...legacyCandidates];
            for (const newCand of newCandidates) {
                const existingIdx = allCandidates.findIndex(c => c.fieldNo === newCand.fieldNo);
                if (existingIdx !== -1) {
                    allCandidates[existingIdx] = newCand;
                } else {
                    allCandidates.push(newCand);
                }
            }

            console.log(`[LegalEntityEnrichmentService.refreshRegistryClaims] Applying ${allCandidates.length} total candidates...`);
            for (const candidate of allCandidates) {
                try {
                    if (candidate.fieldNo === 63) {
                        console.log(`[DEBUG] Field 63 Candidate Value:`, JSON.stringify(candidate.value, null, 2));
                    }
                    // Strip evidenceId to prevent foreign key constraint violations against the Evidence table
                    const cleanCandidate = { ...candidate, evidenceId: null };
                    await kycWriteService.applyFieldCandidate(reference.clientLEId, cleanCandidate, undefined, 'CLIENT_LE');
                } catch (e: any) {
                    console.error(`[LegalEntityEnrichmentService] Failed applying candidate for field ${candidate.fieldNo}:`, e.message);
                }
            }
            console.log(`[LegalEntityEnrichmentService.refreshRegistryClaims] Claims applied.`);

            // Process PSC (Persons with Significant Control) records
            const pscs = (result.record as any).pscs || [];
            if (pscs.length > 0) {
                console.log(`[LegalEntityEnrichmentService.refreshRegistryClaims] Processing ${pscs.length} PSC records...`);
                await kycWriteService.processPSCsForLE(reference.clientLEId, pscs, 'REGISTRATION_AUTHORITY');
                console.log(`[LegalEntityEnrichmentService.refreshRegistryClaims] PSC processing complete.`);
            }
        }

        return result;
    }
}
