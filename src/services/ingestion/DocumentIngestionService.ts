import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import PDFParser from "pdf2json";

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
     * Uses pdf2json which is more stable in Node.js serverless/Next.js environments than pdfjs-dist.
     */
    private async processPDF(buffer: Buffer): Promise<ExtractResult> {
        try {
            // @ts-ignore
            const pdfParser = new PDFParser(null, 1); // 1 = Raw Text Mode

            const rawText = await new Promise<string>((resolve, reject) => {
                pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
                pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
                pdfParser.parseBuffer(buffer);
            });

            // Clean up the text
            // pdf2json output often has "----------------Page (1) Break----------------"
            // We can use this to split pages or just remove it for the full text.
            const fullText = rawText.replace(/----------------Page \(\d+\) Break----------------/g, "\n\n").trim();

            // Attempt to reconstruct pages
            const rawPages = rawText.split(/----------------Page \(\d+\) Break----------------/g);
            // The split might result in an empty first element or similar artifacts, filter them
            const pages: PageMeta[] = rawPages
                .map((text, index) => {
                    const clean = text.trim();
                    return {
                        pageNumber: index + 1, // Approximation
                        text: clean,
                        wordCount: clean.split(/\s+/).length
                    };
                })
                .filter(p => p.text.length > 0);

            // Quality Heuristic
            const totalChars = fullText.length;
            const avgChars = pages.length > 0 ? totalChars / pages.length : 0;
            const isScanned = totalChars < 100 || avgChars < 50;

            if (isScanned) {
                console.warn(`[Ingestion] Low text density (${avgChars}/page). Marking as scanned.`);
            }

            return {
                text: fullText,
                strategy: isScanned ? 'vision' : 'text',
                quality: isScanned ? 0.1 : 0.9,
                pages: pages,
                mime: 'application/pdf'
            };

        } catch (error) {
            console.error("[Ingestion] PDF Parse Error:", error);
            // Fallback for corrupt PDFs
            return {
                text: "",
                strategy: 'vision', // Force vision/OCR downstream if text fails
                quality: 0,
                pages: [],
                mime: 'application/pdf'
            };
        }
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
