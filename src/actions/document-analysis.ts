"use server";
import { DocumentService } from "@/lib/documents/DocumentService";


import prisma from "@/lib/prisma";
import { DocumentKnowledgeExtractorService } from "@/services/ai/DocumentKnowledgeExtractorService";
import { DocumentIngestionService } from "@/services/ingestion/DocumentIngestionService";
import { revalidatePath } from "next/cache";

// Initialize services
const ingestionService = new DocumentIngestionService();
const extractorService = new DocumentKnowledgeExtractorService();

/**
 * Server Action: Analyze Document
 * Uses AI to extract knowledge (Entities, Dates, Facts)
 * Updates the Document metadata with the result for future reference ("Building the Knowledge Base")
 */
export async function analyzeDocument(documentId: string) {
    try {
        console.log(`[Analysis] Starting for Document ${documentId}`);

        // 1. Fetch the Document Record
        const document = await prisma.document.findUnique({
            where: { id: documentId }
        });

        if (!document) {
            return { success: false, error: "Document not found" };
        }

        // 2. Fetch the File Content via unified DocumentService
        // No clientLEId check here since it's just an internal AI pipeline, 
        // but we could pass it if we had it in context.
        const { buffer, mimeType: docMimeType } = await DocumentService.getBuffer(documentId);

        let mimeType = docMimeType || 'application/octet-stream';
        // Fallback for PDFs just in case
        if (document.name.endsWith('.pdf') && mimeType === 'application/octet-stream') {
             mimeType = 'application/pdf';
        }

        const ingestionResult = await ingestionService.processDocument(buffer, mimeType, document.name);

        // 4. AI Extraction Service
        const knowledge = await extractorService.extract(ingestionResult);

        // 5. Store Provenance
        const updatedMetadata = {
            ...(document.metadata as object || {}),
            extractedKnowledge: knowledge,
            extractionDate: new Date().toISOString(),
            extractionVersion: "1.0",
            ingestionQuality: ingestionResult.quality
        };

        await prisma.document.update({
            where: { id: documentId },
            data: {
                metadata: updatedMetadata
            }
        });

        console.log(`[Analysis] Enriched Document ${documentId}. Metadata updated.`);

        revalidatePath(`/app/le/${document.clientLEId}`);
        return { success: true, knowledge };

    } catch (error: any) {
        console.error("[Analysis] Error:", error);
        return { success: false, error: error.message || "Unknown error during analysis" };
    }
}
