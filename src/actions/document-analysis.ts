"use server";

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

        if (!document.fileUrl) {
            return { success: false, error: "Document has no file URL" };
        }

        // Check if extraction already exists (provenance check)
        // If meta.extractedKnowledge exists, we could return early.
        // But for development iteration, let's allow re-analysis.

        // 2. Fetch the File Content (Assume public read access for blob, or authenticated fetch)
        // If Vercel Blob is public, fetch works. If stored elsewhere, adapt.
        const response = await fetch(document.fileUrl);
        if (!response.ok) {
            console.error(`[Analysis] Failed to fetch file from ${document.fileUrl}`);
            return { success: false, error: "Failed to download document content" };
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 3. Ingest Parsing (PDF/Docx -> Text)
        // Similar to questionnaire ingest logic
        let mimeType = document.fileType || response.headers.get("content-type") || "application/octet-stream";
        // Override for PDF based on filename for reliability
        if (document.name.endsWith('.pdf')) mimeType = 'application/pdf';

        const ingestionResult = await ingestionService.processDocument(buffer, mimeType, document.name);

        // 4. AI Extraction Service
        const knowledge = await extractorService.extract(ingestionResult);

        // 5. Store Provenance
        // We update the Document metadata. This is the "Knowledge Base Entry" linked to the source.
        // We preserve existing metadata and merge the new knowledge.
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
                metadata: updatedMetadata,
                // Optional: Update docType if AI is confident
                docType: (knowledge.documentType.toUpperCase().includes('IDENTITY') ? 'IDENTITY' :
                    knowledge.documentType.toUpperCase().includes('FINANCIAL') ? 'FINANCIAL' :
                        knowledge.documentType.toUpperCase().includes('CORPORATE') ? 'CORPORATE' :
                            document.docType) || "OTHER"
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
