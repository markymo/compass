import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import JSZip from 'jszip';
import PDFParser from 'pdf2json';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();

const prisma = new PrismaClient();

function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(null, true);
        parser.on("pdfParser_dataError", (err: any) => reject(err.parserError));
        parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
        parser.parseBuffer(buffer);
    });
}

test.describe('ONP-200 & ONP-201 Live Smoke Tests on dev.onpro.tech', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let relationshipId: string;
    let questionnaireId: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        relationshipId = manifest.relationshipAlpha.id;

        // Find a questionnaire on the relationship or clientLE
        const q = await prisma.questionnaire.findFirst({
            where: {
                fiEngagementId: relationshipId,
                isDeleted: false
            },
            include: { questions: true }
        });

        if (q) {
            questionnaireId = q.id;
        } else {
            // Fallback to any active questionnaire for alpha client LE
            const anyQ = await prisma.questionnaire.findFirst({
                where: { isDeleted: false },
                include: { questions: true }
            });
            expect(anyQ).toBeDefined();
            questionnaireId = anyQ!.id;
        }
    });

    test('1. Standalone Questionnaire PDF export renders without "Answer:" and without duplicate/corrupted Evidence', async ({ request }) => {
        const response = await request.get(`/api/export/questionnaire/${questionnaireId}`);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/pdf');

        const pdfBuffer = await response.body();
        expect(pdfBuffer.length).toBeGreaterThan(1000);

        const text = await parsePdfBuffer(pdfBuffer);

        // ONP-200 Invariant: "Answer:" prefix must not appear
        const answerPrefixCount = (text.match(/Answer:/g) || []).length;
        expect(answerPrefixCount).toBe(0);

        // ONP-201 Invariants: Legacy Evidence labels and corrupted emojis must not appear
        const evidenceAttachedCount = (text.match(/Evidence Attached/gi) || []).length;
        expect(evidenceAttachedCount).toBe(0);

        const emojiCount = (text.match(/📄/g) || []).length;
        expect(emojiCount).toBe(0);
    });

    test('2. Output Pack Questionnaire PDF export renders without "Answer:" and without duplicate/corrupted Evidence', async ({ request }) => {
        const response = await request.post('/api/export/output-pack', {
            data: {
                engagementId: relationshipId,
                clientLEId,
                questionnaireIds: [questionnaireId],
                documentIds: [],
                includeMasterData: true,
                includeEvidenceFiles: true
            }
        });

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/zip');

        const zipBuffer = await response.body();
        const zip = await JSZip.loadAsync(zipBuffer);
        const filePaths = Object.keys(zip.files);

        // Find questionnaire PDF in zip
        const qPdfPath = filePaths.find(p => p.startsWith('Questionnaires/') && p.endsWith('.pdf'));
        expect(qPdfPath).toBeDefined();

        const qPdfData = await zip.file(qPdfPath!)!.async('nodebuffer');
        const text = await parsePdfBuffer(qPdfData);

        // ONP-200 Invariant: "Answer:" prefix must not appear
        const answerPrefixCount = (text.match(/Answer:/g) || []).length;
        expect(answerPrefixCount).toBe(0);

        // ONP-201 Invariants: Legacy Evidence labels and corrupted emojis must not appear
        const evidenceAttachedCount = (text.match(/Evidence Attached/gi) || []).length;
        expect(evidenceAttachedCount).toBe(0);

        const emojiCount = (text.match(/📄/g) || []).length;
        expect(emojiCount).toBe(0);
    });
});
