import prisma from "@/lib/prisma";
import crypto from "crypto";
import { EvidenceProvider } from "@prisma/client";

export class EvidenceService {
    /**
     * Normalizes and stores a provider payload.
     * Computes SHA-256 hash to deduplicate.
     * Returns the evidence_id (UUID).
     */
    async normalizeEvidence(
        payload: any,
        provider: EvidenceProvider,
        schemaVersion: string = "1.0",
        capturedBy?: string
    ): Promise<string> {
        // 1. Compute Hash (Simple JSON stringify for now - standardisation might be needed for strict canonicalization)
        const jsonString = JSON.stringify(payload);
        const hash = crypto.createHash('sha256').update(jsonString).digest('hex');

        // 2. Check for existence (Data Deduplication)
        const existing = await prisma.evidenceStore.findUnique({
            where: { hash }
        });

        if (existing) {
            return existing.id;
        }

        // 3. Store new evidence
        const created = await prisma.evidenceStore.create({
            data: {
                hash,
                provider,
                payload,
                schemaVersion,
                retrievedAt: new Date(),
                capturedBy
            }
        });

        return created.id;
    }

    /**
     * Retrieval helper
     */
    async getEvidence(evidenceId: string) {
        return prisma.evidenceStore.findUnique({
            where: { id: evidenceId }
        });
    }
}
