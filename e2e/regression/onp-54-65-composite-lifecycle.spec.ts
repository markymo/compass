import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import PDFParser from 'pdf2json';

// Contract: COMP-01 — Composite group answer resolution and PDF export lifecycle
// Linear: ONP-54, ONP-65

const prisma = new PrismaClient();

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new (PDFParser as any)(null, 1);
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', () => {
            const rawText = (pdfParser as any).getRawTextContent();
            resolve(rawText);
        });
        pdfParser.parseBuffer(pdfBuffer);
    });
}

test.describe('COMP-01 / ONP-54 + ONP-65 — Composite Group Canonical Resolution & Export Lifecycle', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let disposableLegalEntityId: string;
    let engagementId: string;
    let supplierOrgId: string;
    let testQuestionnaire: any;
    let compositeGroup: any;
    let disposableLEName: string;

    const testTimestamp = Date.now();
    const testPrefix = `COMP01_${testTimestamp}`;
    const testDirectorSurname = `Vanderbilt_${testTimestamp}`;
    const directorForenames = 'Arthur Bartholomew';
    const roleTitle = 'Executive Director & Controller';

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        const alphaLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] },
            include: { owners: true }
        });
        if (!alphaLE) throw new Error('uat_cle_alpha not found in database');

        const leAdminEmail = manifest.actors.leAdminAlpha.email;
        const leAdminUser = await prisma.user.findFirst({
            where: { email: leAdminEmail }
        });
        if (!leAdminUser) throw new Error(`${leAdminEmail} user not found`);

        const supplierOrg = await prisma.organization.findFirst({
            where: { name: { contains: 'Supplier Org A' } }
        });
        supplierOrgId = supplierOrg?.id || manifest.supplierOrgA.id;

        // Shared-fixture preservation: create a fully disposable synthetic LegalEntity & ClientLE
        disposableLEName = `Disposable CLE COMP-01 ${testTimestamp}`;
        const disposableLegalEntity = await prisma.legalEntity.create({
            data: {
                reference: `COMP_${testTimestamp}`,
                name: disposableLEName,
                jurisdiction: 'GB'
            }
        });
        disposableLegalEntityId = disposableLegalEntity.id;

        const disposableLE = await prisma.clientLE.create({
            data: {
                shortCode: `uat_cle_comp_${testTimestamp}`,
                name: disposableLEName,
                legalEntityId: disposableLegalEntity.id,
                owners: {
                    create: {
                        partyId: alphaLE.owners[0]?.partyId || alphaLE.id
                    }
                },
                memberships: {
                    create: {
                        userId: leAdminUser.id,
                        role: 'LE_ADMIN'
                    }
                }
            }
        });
        clientLEId = disposableLE.id;

        // Create disposable engagement between disposable ClientLE and supplier
        const engagement = await prisma.fIEngagement.create({
            data: {
                clientLEId: disposableLE.id,
                fiOrgId: supplierOrgId,
                status: 'INVITED',
            }
        });
        engagementId = engagement.id;

        // Find CONTROLLERS composite group
        compositeGroup = await prisma.masterFieldGroup.findFirst({
            where: { key: 'CONTROLLERS', isActive: true },
            include: { items: { include: { field: true } } }
        });
        if (!compositeGroup) throw new Error('CONTROLLERS composite group not found');

        // Create questionnaire mapped to CONTROLLERS composite group
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

        // Seed distinctive multi-attribute director claim on Field 63 (Company directors)
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId: disposableLegalEntity.id,
                fieldNo: 63,
                collectionId: 'DIRECTORS',
                instanceId: `dir_${testTimestamp}`,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                sourceReference: 'USER_INPUT',
                valueJson: {
                    forenames: directorForenames,
                    surname: testDirectorSurname,
                    organisationName: null,
                    partyType: 'PERSON',
                    roles: [{ roleTitle, roleType: 'DIRECTOR' }],
                    nationalities: ['British']
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
            if (engagementId) {
                await prisma.fIEngagement.delete({ where: { id: engagementId } }).catch(() => {});
            }
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.clientLE.delete({ where: { id: clientLEId } }).catch(() => {});
            }
            if (disposableLegalEntityId) {
                await prisma.legalEntity.delete({ where: { id: disposableLegalEntityId } }).catch(() => {});
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-54-65:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Master Record card renders canonical composite child elements (name, surname, role)', async ({ browser }) => {
        const clientContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await clientContext.newPage();

        try {
            await page.goto(`/app/le/${clientLEId}/master`);
            await page.waitForLoadState('domcontentloaded');

            // Click Ownership & control category tab where Field 63 resides
            const tabBtn = page.locator('button:has-text("Ownership & control"), [role="tab"]:has-text("Ownership & control")').first();
            if (await tabBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await tabBtn.click();
            }

            // Locate Field 63 card (Company directors)
            const f63Card = page.locator('div:has-text("Company directors"), div:has-text("Field 63")').filter({ hasText: testDirectorSurname }).first();
            await expect(f63Card).toBeVisible({ timeout: 20000 });

            // Positive assertion: distinct individual child fields are projected and displayed
            await expect(f63Card).toContainText(directorForenames);
            await expect(f63Card).toContainText(testDirectorSurname);
            await expect(f63Card).toContainText(roleTitle);
        } finally {
            await page.close();
            await clientContext.close();
        }
    });

    test('2. Mapped Workbench displays composite elements without false "No master data available", with fresh context reload', async ({ browser }) => {
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await supplierContext.newPage();

        try {
            // Navigate to supplier Questions Workbench for this relationship
            await page.goto(`/app/s/${supplierOrgId}/questions?rel=${encodeURIComponent(disposableLEName)}`);
            await page.waitForLoadState('domcontentloaded');

            // Fresh context reload to ensure clean server state
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            const answerContainer = page.locator(`div:has(h3:has-text("${testPrefix}"))`).last();
            await expect(answerContainer).toBeVisible({ timeout: 20000 });
            await expect(answerContainer).toContainText(directorForenames);
            await expect(answerContainer).toContainText(testDirectorSurname);
            await expect(answerContainer).toContainText(roleTitle);

            // Assert NO false empty-state alert
            const emptyAlert = answerContainer.locator('text=No master data available');
            await expect(emptyAlert).not.toBeVisible();
        } finally {
            await page.close();
            await supplierContext.close();
        }
    });

    test('3. PDF export includes composite child labels and populated values without "No response recorded"', async ({ browser }) => {
        const clientContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await clientContext.newPage();

        try {
            // Request PDF export for the test questionnaire via API endpoint
            const res = await page.request.get(`/api/export/questionnaire/${testQuestionnaire.id}?engagementId=${engagementId}`);
            expect(res.status()).toBe(200);

            const buffer = await res.body();
            expect(buffer.length).toBeGreaterThan(100);

            // Parse text content from generated PDF binary
            const extractedText = await extractPdfText(buffer);

            // Assert question title, child labels, and child values in PDF output
            expect(extractedText).toContain(testPrefix);
            expect(extractedText).toContain(directorForenames);
            expect(extractedText).toContain(testDirectorSurname);
            expect(extractedText).toContain(roleTitle);
            expect(extractedText).not.toContain('No response recorded');
        } finally {
            await page.close();
            await clientContext.close();
        }
    });
});
