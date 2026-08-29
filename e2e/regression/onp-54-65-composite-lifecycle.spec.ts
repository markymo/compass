import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import PDFParser from 'pdf2json';

// Contract: COMP-01 — A populated composite group resolves canonically from Master into mapped questionnaire/Workbench and output/export surfaces
// Linear: ONP-54 + ONP-65

const prisma = new PrismaClient();
const authPath = path.resolve(__dirname, '../../playwright/.auth/le-admin-alpha.json');
const supplierAuthPath = path.resolve(__dirname, '../../playwright/.auth/supplier-org-admin-a.json');

function extractPdfText(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new (PDFParser as any)(null, 1);
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', () => {
            const rawText = pdfParser.getRawTextContent();
            resolve(rawText);
        });
        pdfParser.parseBuffer(buffer);
    });
}

test.describe('COMP-01 / ONP-54 + ONP-65 — Composite Group Canonical Resolution & Export Lifecycle', () => {
    test.setTimeout(90000);

    let clientLEId: string;
    let supplierOrgId: string;
    let engagementId: string;
    let testQuestionnaire: any;
    let testQuestion: any;
    let compositeGroup: any;

    const testTimestamp = Date.now();
    const testPrefix = `COMP01 ${testTimestamp}`;
    const directorName = `Sir Arthur Composite ${testTimestamp.toString().slice(-4)}`;
    const roleTitle = `Executive Director ${testTimestamp.toString().slice(-4)}`;

    test.beforeAll(async () => {
        const clientLE = await prisma.clientLE.findFirst({
            where: { shortCode: 'uat_cle_alpha' }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found');

        const engagement = await prisma.fIEngagement.findFirst({
            where: { clientLEId: clientLE.id, isDeleted: false }
        });
        if (!engagement) throw new Error(`Engagement not found for ${clientLE.id}`);

        clientLEId = clientLE.id;
        supplierOrgId = engagement.fiOrgId;
        engagementId = engagement.id;

        // Find or verify CONTROLLERS composite group
        compositeGroup = await prisma.masterFieldGroup.findFirst({
            where: { key: 'CONTROLLERS', isActive: true },
            include: { items: { include: { field: true } } }
        });
        if (!compositeGroup) throw new Error('CONTROLLERS composite group not found');

        // Create questionnaire with question mapped to masterQuestionGroupId: CONTROLLERS
        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                fiOrgId: supplierOrgId,
                fiEngagementId: engagementId,
                name: `${testPrefix} Governance Questionnaire`,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                referenceCode: `COMP_${testTimestamp.toString().slice(-6)}`,
                questions: {
                    create: [
                        {
                            text: `${testPrefix}: List of company controllers and directors`,
                            order: 1,
                            masterQuestionGroupId: compositeGroup.key,
                            status: 'SHARED'
                        }
                    ]
                }
            },
            include: { questions: true }
        });
        testQuestion = testQuestionnaire.questions[0];

        // Seed distinctive director claim on Field 63 (Company directors)
        await prisma.fieldClaim.deleteMany({
            where: {
                clientLEId,
                fieldNo: 63,
            }
        });

        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                fieldNo: 63,
                collectionId: 'CONTROLLERS',
                instanceId: `dir_${testTimestamp}`,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                sourceReference: 'USER_INPUT',
                valueJson: {
                    forenames: 'Arthur',
                    surname: `Composite ${testTimestamp.toString().slice(-4)}`,
                    organisationName: null,
                    partyType: 'PERSON',
                    roles: [{ roleTitle, roleType: 'DIRECTOR' }]
                },
                assertedAt: new Date('2026-08-25T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-25T10:00:00.000Z'),
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (testQuestionnaire?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
                await prisma.questionnaire.delete({ where: { id: testQuestionnaire.id } });
            }
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({
                    where: {
                        clientLEId,
                        fieldNo: 63,
                    }
                });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-54-65:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Mapped Workbench displays composite elements and no false "No master data available"', async ({ browser }) => {
        const supplierContext = await browser.newContext({ storageState: supplierAuthPath });
        const page = await supplierContext.newPage();

        try {
            await page.goto(`/app/s/${supplierOrgId}/questions?rel=UAT%20Alpha%20Limited&q=${encodeURIComponent(testQuestionnaire.name)}`);
            await page.waitForLoadState('domcontentloaded');

            // Find question row
            const questionHeading = page.locator(`h3:has-text("${testPrefix}")`).first();
            await expect(questionHeading).toBeVisible({ timeout: 15000 });

            // Assert question answer contains director name
            const answerContainer = page.locator(`div:has(h3:has-text("${testPrefix}"))`).last();
            await expect(answerContainer).toContainText('Arthur');
            await expect(answerContainer).toContainText(`Composite ${testTimestamp.toString().slice(-4)}`);

            // Assert NO false "No master data available"
            await expect(answerContainer.locator('text=/No master data available/i')).toHaveCount(0);
        } finally {
            await supplierContext.close();
        }
    });

    test('2. PDF export includes composite child labels and populated values', async ({ browser }) => {
        const clientContext = await browser.newContext({ storageState: authPath });
        const page = await clientContext.newPage();

        try {
            const downloadUrl = `/api/export/questionnaire/${testQuestionnaire.id}?engagementId=${engagementId}`;
            const response = await page.request.get(downloadUrl);
            expect(response.ok()).toBe(true);

            const buffer = await response.body();
            const extractedText = await extractPdfText(buffer);

            // Assert question text and composite child values in PDF
            expect(extractedText).toContain(testPrefix);
            expect(extractedText).toContain('Arthur');
            expect(extractedText).toContain(`Composite ${testTimestamp.toString().slice(-4)}`);
        } finally {
            await clientContext.close();
        }
    });
});
