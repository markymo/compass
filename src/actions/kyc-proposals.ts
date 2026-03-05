"use server";

import { fetchGLEIFData } from "@/actions/gleif";
import { EvidenceService } from "@/services/kyc/EvidenceService";
import { mapGleifPayloadToFieldCandidates } from "@/services/kyc/normalization/GleifNormalizer";
import { KycWriteService } from "@/services/kyc/KycWriteService";
import { FieldProposal } from "@/domain/kyc/types/ProposalTypes";
import { getFieldDefinition } from "@/domain/kyc/FieldDefinitions";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getIdentity } from "@/lib/auth";

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

        // 4. Normalize
        const candidates = mapGleifPayloadToFieldCandidates(gleifResult.data, evidenceId);

        // 5. Evaluate Proposals
        const proposals: FieldProposal[] = [];

        for (const candidate of candidates) {
            const def = getFieldDefinition(candidate.fieldNo);

            // Pass 'CLIENT_LE' because legalEntityId here is a ClientClientLE.id
            const evaluation = await kycWriteService.evaluateFieldCandidate(legalEntityId, candidate, 'CLIENT_LE');

            proposals.push({
                fieldNo: candidate.fieldNo,
                fieldName: def.fieldName,
                table: def.model,
                column: def.field,
                current: evaluation.currentValue ? {
                    value: evaluation.currentValue,
                    source: evaluation.currentSource || 'SYSTEM' // specific unknown source
                } : undefined,
                proposed: {
                    value: candidate.value,
                    source: 'GLEIF',
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
        const candidates = mapGleifPayloadToFieldCandidates(clientLE.gleifData, evidenceId);

        // 3. Evaluate Proposals
        const proposals: FieldProposal[] = [];

        for (const candidate of candidates) {
            const def = getFieldDefinition(candidate.fieldNo);
            const evaluation = await kycWriteService.evaluateFieldCandidate(legalEntityId, candidate, 'CLIENT_LE');

            proposals.push({
                fieldNo: candidate.fieldNo,
                fieldName: def.fieldName,
                table: def.model,
                column: def.field,
                current: evaluation.currentValue ? {
                    value: evaluation.currentValue,
                    source: evaluation.currentSource || 'SYSTEM'
                } : undefined,
                proposed: {
                    value: candidate.value,
                    source: 'GLEIF',
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
 * re-applies the logic securely by fetching evidence and re-deriving to prevent client tampering.
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

        // 2. Normalize (Provider Agnostic - derived from evidence.provider)
        let candidates;
        if (evidence.provider === 'GLEIF') {
            candidates = mapGleifPayloadToFieldCandidates(evidence.payload, evidenceId);
        } else {
            // Future handlers
            return { success: false, message: `Provider ${evidence.provider} not supported for acceptance yet.` };
        }

        // 3. Find Candidate
        const candidate = candidates.find(c => c.fieldNo === fieldNo);
        if (!candidate) return { success: false, message: "Field candidate not found in evidence" };

        // 4. Apply
        // We use the authenticated user ID for proper provenance tracking and verification
        const identity = await getIdentity();
        let userId = undefined;
        if (identity?.userId) {
            userId = identity.userId;
        }

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
