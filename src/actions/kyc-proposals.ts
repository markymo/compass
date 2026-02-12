"use server";

import { fetchGLEIFData } from "@/actions/gleif";
import { EvidenceService } from "@/services/kyc/EvidenceService";
import { mapGleifPayloadToFieldCandidates } from "@/services/kyc/normalization/GleifNormalizer";
import { KycWriteService } from "@/services/kyc/KycWriteService";
import { FieldProposal } from "@/domain/kyc/types/ProposalTypes";
import { getFieldDefinition } from "@/domain/kyc/FieldDefinitions";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

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
        // 1. Get LEI from DB
        const le = await prisma.clientLE.findUnique({
            where: { id: legalEntityId },
            // @ts-ignore
            include: { identityProfile: true }
        }) as any; // Cast to specific type if generated, or any to bypass stale types

        if (!le) return { success: false, message: "Legal Entity not found" };

        // Prefer LEI from IdentityProfile (Canonical), fallback to ClientLE (Legacy/Input)
        const lei = le.identityProfile?.leiCode || le.lei;

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
                    evidenceId: candidate.evidenceId,
                    timestamp: new Date().toISOString()
                },
                action: evaluation.action,
                reason: evaluation.reason
            });
        }

        revalidatePath(`/app/le/${legalEntityId}`);
        return { success: true, proposals };

    } catch (error: any) {
        console.error("refreshGleifProposals error:", error);
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
        // We use a system user ID or specific trigger user if available from auth context
        // For now, passing undefined (SYSTEM) as verifiedBy, or we could pass "USER_ACCEPT_ACTION"
        // Pass 'CLIENT_LE' because legalEntityId is ClientLE ID
        const result = await kycWriteService.applyFieldCandidate(legalEntityId, candidate, 'USER_ACTION', 'CLIENT_LE');

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
