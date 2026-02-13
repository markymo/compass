"use server";

import { getIdentity } from "@/lib/auth";
import { DocumentIngestionService } from "@/services/ingestion/DocumentIngestionService";
import { QuestionnaireExtractorService } from "@/services/ai/QuestionnaireExtractorService";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { EvidenceProvider } from "@prisma/client";
import { EvidenceService } from "@/services/kyc/EvidenceService";

// Services
const ingestionService = new DocumentIngestionService();
const extractionService = new QuestionnaireExtractorService();
const evidenceService = new EvidenceService();

export async function uploadAndExtractQuestionnaire(formData: FormData, clientLEId: string) {
    const identity = await getIdentity();
    if (!identity) throw new Error("Unauthorized");

    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");

    console.log(`[Upload] Starting ingestion for ${file.name}`);

    try {
        // 1. Upload to Vercel Blob (Preserve Original)
        // Note: In non-edge runtime, we can read buffer directly
        const buffer = Buffer.from(await file.arrayBuffer());

        const blob = await put(`questionnaires/${clientLEId}/${Date.now()}-${file.name}`, file, {
            access: 'public',
        });


        console.log(`[Upload] Blob stored at ${blob.url}`);

        // 2. Create Document Registry Record (Phase 2 Model)
        // We link it to the LEGAL ENTITY of the ClientLE (Bridge lookup)
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            include: { identityProfile: true } // Bridge to LE
        });

        // Resolve Owner (LegalEntity)
        let ownerId = clientLE?.identityProfile?.legalEntityId;

        // Safety Fallback: If no Phase 2 LE exists yet, we can't create a DocumentRegistry record easily
        // because it foreign keys to LegalEntity. 
        // BUT, the user requirement said "Use DocumentRegistry".
        // If we ignore this for checking and just use ClientLE ID context for now or create a placeholder LE?
        // Let's assume the LE exists (Migration Phase 2). If not, we might fail or need a fallback.

        let docRegistryId = "PENDING_LE_MIGRATION";

        if (ownerId) {
            const doc = await prisma.documentRegistry.create({
                data: {
                    legalEntityId: ownerId,
                    ownerType: "LEGAL_ENTITY",
                    ownerId: ownerId,
                    fieldNo: 0, // Questionnaire Generic
                    filePath: blob.url,
                    fileName: file.name, // Use original name from file object
                    mimeType: file.type,
                    uploadedBy: identity.userId
                }
            });
            docRegistryId = doc.id;
        } else {
            console.warn("[Upload] Warning: ClientLE has no linked LegalEntity. Skipping DocumentRegistry creation.");
        }

        // 3. Ingest Parsing
        const ingestionResult = await ingestionService.processDocument(buffer, file.type, file.name);

        // 4. AI Extraction
        const structure = await extractionService.extract(ingestionResult, clientLEId);

        // 5. Store Evidence
        const evidenceId = await evidenceService.normalizeEvidence(
            {
                fileName: file.name,
                fileUrl: blob.url,
                mimeType: file.type,
                docRegistryId,
                ingestionMeta: {
                    strategy: ingestionResult.strategy,
                    quality: ingestionResult.quality,
                    pages: ingestionResult.pages.length
                },
                structure // The extracted questions
            },
            EvidenceProvider.USER_UPLOAD,
            "2.0", // Schema version for this extractor
            identity.userId
        );

        revalidatePath(`/app/le/${clientLEId}`);
        return {
            success: true,
            evidenceId,
            docRegistryId,
            questionCount: structure.length,
            structure
        };

    } catch (error: any) {
        console.error("[Upload] Error:", error);
        return { success: false, error: error.message };
    }
}
