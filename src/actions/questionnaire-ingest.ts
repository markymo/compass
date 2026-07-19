"use server";
import { DocumentService } from "@/lib/documents/DocumentService";


import { getIdentity } from "@/lib/auth";
import { DocumentIngestionService } from "@/services/ingestion/DocumentIngestionService";
import { QuestionnaireExtractorService } from "@/services/ai/QuestionnaireExtractorService";
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
        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. Upload to Private Vercel Blob and create canonical Document
        const document = await DocumentService.uploadServerSideDocument({
            file,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            uploadedById: identity.userId,
            clientLEId: clientLEId,
            pathPrefix: `questionnaires/${clientLEId}`
        });



        // 3. Ingest Parsing
        const ingestionResult = await ingestionService.processDocument(buffer, file.type, file.name);

        // 4. AI Extraction
        const structure = await extractionService.extract(ingestionResult, clientLEId);

        // 5. Store Evidence
        const evidenceId = await evidenceService.normalizeEvidence(
            {
                fileName: file.name,
                mimeType: file.type,
                documentId: document.id,
                storagePathname: document.storagePathname!,
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
            documentId: document.id,
            questionCount: structure.length,
            structure
        };

    } catch (error: any) {
        console.error("[Upload] Error:", error);
        return { success: false, error: error.message };
    }
}
