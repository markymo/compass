// Use dynamic import for pdfjs inside the method to avoid build-time worker issues
// import { pdfToText } from "pdfjs-dist/legacy/build/pdf"; remove this line

import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from 'uuid';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"; // Try standard import if available, or rely on dynamic.


// Types
export type IngestionStrategy = 'text' | 'vision';

export interface PageMeta {
    pageNumber: number;
    text: string;
    wordCount: number;
}

export interface ExtractResult {
    text: string;
    strategy: IngestionStrategy;
    quality: number; // 0-1 score of text density/coherence
    pages: PageMeta[];
    mime: string;
}

export class DocumentIngestionService {

    /**
     * Main Entry Point: Detects type and routes to specific extractor
     */
    async processDocument(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractResult> {
        console.log(`[Ingestion] Processing ${fileName} (${mimeType}) size=${buffer.length}`);

        if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
            return this.processPDF(buffer);
        }

        if (mimeType.includes('word') || fileName.endsWith('.docx')) {
            return this.processDOCX(buffer);
        }

        if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx')) {
            return this.processXLSX(buffer);
        }

        if (mimeType.startsWith('image/')) {
            return {
                text: "",
                strategy: 'vision',
                quality: 1.0, // Images are always "high quality" for Vision
                pages: [],
                mime: mimeType
            };
        }

        if (mimeType === 'text/plain' || mimeType === 'text/csv' || fileName.endsWith('.csv')) {
            return {
                text: buffer.toString('utf-8'),
                strategy: 'text',
                quality: 1.0,
                pages: [{ pageNumber: 1, text: buffer.toString('utf-8'), wordCount: buffer.length }],
                mime: mimeType
            }
        }

        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    /**
     * PDF Processing Strategy
     * 1. Try to extract meaningful text.
     * 2. If text is sparse (scanned), return strategy='vision'.
     */
    private async processPDF(buffer: Buffer): Promise<ExtractResult> {
        // Dynamic import to avoid build issues if we are in environment without strict standard lib
        const pdfJS = await import("pdfjs-dist/legacy/build/pdf.mjs");

        // Polyfill standard font/canvas if needed, but for text-only extract usually simple load works
        const data = new Uint8Array(buffer);
        const loadingTask = pdfJS.getDocument({ data });
        const pdfDocument = await loadingTask.promise;

        let fullText = "";
        const pages: PageMeta[] = [];
        let totalChars = 0;
        let totalUnprintable = 0;

        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const content = await page.getTextContent();

            const pageStrings = content.items.map((item: any) => item.str);
            const pageText = pageStrings.join(" "); // Space delimiter

            fullText += pageText + "\n\n";
            pages.push({
                pageNumber: i,
                text: pageText,
                wordCount: pageText.split(/\s+/).length
            });

            totalChars += pageText.length;
            // Simple heuristic for "gibberish" or "encoding errors"
            // Count characters that are not alphanumeric or basic punctuation
            const unprintableMatches = pageText.match(/[^\x20-\x7E\n\r\t]/g);
            if (unprintableMatches) {
                totalUnprintable += unprintableMatches.length;
            }
        }

        // Quality Heuristic
        // If < 50 chars per page on average, probably scanned.
        const avgChars = totalChars / pdfDocument.numPages;
        const gibberishRatio = totalChars > 0 ? (totalUnprintable / totalChars) : 0;

        let strategy: IngestionStrategy = 'text';
        let quality = 1.0;

        if (avgChars < 50) {
            console.warn(`[Ingestion] Low text density (${avgChars}/page). Marking as scanned.`);
            strategy = 'vision';
            quality = 0.1;
        } else if (gibberishRatio > 0.2) {
            console.warn(`[Ingestion] High gibberish ratio (${gibberishRatio}). Marking as likely scanned/corrupted.`);
            strategy = 'vision';
            quality = 0.3;
        }

        return {
            text: fullText,
            strategy,
            quality,
            pages,
            mime: 'application/pdf'
        };
    }

    private async processDOCX(buffer: Buffer): Promise<ExtractResult> {
        const result = await mammoth.extractRawText({ buffer });
        return {
            text: result.value,
            strategy: 'text',
            quality: 1.0,
            pages: [{ pageNumber: 1, text: result.value, wordCount: result.value.split(/\s+/).length }],
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
    }

    private async processXLSX(buffer: Buffer): Promise<ExtractResult> {
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        let fullText = "";
        const pages: PageMeta[] = [];

        workbook.SheetNames.forEach((sheetName, index) => {
            const worksheet = workbook.Sheets[sheetName];
            // Get TSV (Tab Separated Values) which is good for LLMs to understand structure
            const sheetText = XLSX.utils.sheet_to_csv(worksheet, { FS: "\t" });

            const sectionHeader = `\n--- SHEET: ${sheetName} ---\n`;
            const content = sectionHeader + sheetText;

            fullText += content;
            pages.push({
                pageNumber: index + 1,
                text: content,
                wordCount: sheetText.split(/\s+/).length
            });
        });

        return {
            text: fullText,
            strategy: 'text', // Excel is always text structure basically
            quality: 1.0,
            pages,
            mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
    }
}
