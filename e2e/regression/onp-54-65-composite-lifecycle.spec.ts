import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import PDFParser from 'pdf2json';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: COMP-01 — A populated composite group resolves canonically from Master into mapped questionnaire/Workbench and output/export surfaces
// Linear: ONP-54 + ONP-65

const prisma = new PrismaClient();

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

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let disposableLEName: string;
    let supplierOrgId: string;
    let engagementId: string;
    let testQuestionnaire: any;
    let compositeGroup: any;

    const testTimestamp = Date.now();
    const testPrefix = `COMP01_${testTimestamp}`;
    const directorForenames = 'Arthur Bartholomew';
    const testDirectorSurname = `Composite-Director-${testTimestamp.toString().slice(-4)}`;
    const roleTitle = 'Managing Director';

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const alphaLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] },
            include: { owners: true }
        });
        if (!alphaLE) throw new Error('uat_cle_alpha not found in database');

        const leAdminUser = await prisma.user.findUnique({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!leAdminUser) throw new Error(`LE Admin user ${manifest.actors.leAdminAlpha.email} not found`);

        const supplierOrg = await prisma.organization.findFirst({
            where: { OR: [{ id: manifest.supplierOrgA.id }, { shortCode: 'uat_supplier_org_a' }] }
        });
        if (!supplierOrg) throw new Error('uat_supplier_org_a not found');
        supplierOrgId = supplierOrg.id;

        // Shared-fixture preservation: create a fully disposable synthetic ClientLE
        disposableLEName = `Disposable CLE COMP-01 ${testTimestamp}`;
        const disposableLE = await prisma.clientLE.create({
            data: {
                shortCode: `uat_cle_comp_${testTimestamp}`,
                name: disposableLEName,
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
            const fieldCard = page.locator('[data-testid="master-field-63"], [data-field-no="63"]').first();
            await expect(fieldCard).toBeVisible({ timeout: 15000 });

            // Assert canonical child elements are visible in read-only Master representation
            await expect(fieldCard).toContainText(directorForenames);
            await expect(fieldCard).toContainText(testDirectorSurname);
            await expect(fieldCard).toContainText(roleTitle);
        } finally {
            await clientContext.close();
        }
    });

    test('2. Mapped Workbench displays composite elements without false "No master data available", with fresh context reload', async ({ browser }) => {
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await supplierContext.newPage();

        try {
            await page.goto(`/app/s/${supplierOrgId}/questions?rel=${encodeURIComponent(disposableLEName)}&q=${encodeURIComponent(testQuestionnaire.name)}`);
            await page.waitForLoadState('domcontentloaded');

            // Locate question card
            const questionHeading = page.locator(`h3:has-text("${testPrefix}")`).first();
            await expect(questionHeading).toBeVisible({ timeout: 15000 });

            const answerContainer = page.locator(`div:has(h3:has-text("${testPrefix}"))`).last();
            await expect(answerContainer).toContainText(directorForenames);
            await expect(answerContainer).toContainText(testDirectorSurname);
            await expect(answerContainer).toContainText(roleTitle);

            // Assert false "No master data available" placeholder is absent
            await expect(answerContainer.locator('text=/No master data available/i')).toHaveCount(0);

            // Reload page in fresh context to verify persistence
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            const reloadedContainer = page.locator(`div:has(h3:has-text("${testPrefix}"))`).last();
            await expect(reloadedContainer).toContainText(directorForenames);
            await expect(reloadedContainer).toContainText(testDirectorSurname);
            await expect(reloadedContainer).toContainText(roleTitle);
            await expect(reloadedContainer.locator('text=/No master data available/i')).toHaveCount(0);
        } finally {
            await supplierContext.close();
        }
    });

    test('3. PDF export includes composite child labels and populated values without "No response recorded"', async ({ browser }) => {
        const clientContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await clientContext.newPage();

        try {
            const downloadUrl = `/api/export/questionnaire/${testQuestionnaire.id}?engagementId=${engagementId}`;
            const response = await page.request.get(downloadUrl);
            expect(response.ok()).toBe(true);

            const buffer = await response.body();
            const extractedText = await extractPdfText(buffer);

            // Assert question title, child labels, and child values in PDF output
            expect(extractedText).toContain(testPrefix);
            expect(extractedText).toContain(directorForenames);
            expect(extractedText).toContain(testDirectorSurname);
            expect(extractedText).toContain(roleTitle);
            expect(extractedText).not.toContain('No response recorded');
        } finally {
            await clientContext.close();
        }
    });
});
