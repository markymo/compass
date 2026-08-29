import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: DOC-01 — A relationship document that the user is entitled to see is visible and directly openable/downloadable as an individual file
// Linear: ONP-29, ONP-64

const prisma = new PrismaClient();

test.describe('DOC-01 / ONP-29 + ONP-64 — Relationship Document & Output Pack Direct Download Flow', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let engagementId: string;
    let testDocId: string;

    const testTimestamp = Date.now();
    const testDocName = `DOC01_Rel_Doc_${testTimestamp}.pdf`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const clientLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');
        clientLEId = clientLE.id;

        const engagement = await prisma.fIEngagement.findFirst({
            where: { clientLEId: clientLE.id, isDeleted: false },
            include: { org: true }
        });
        if (!engagement) throw new Error(`Active engagement for ${clientLE.id} not found`);
        engagementId = engagement.id;

        // Clean up previous test documents
        await prisma.document.deleteMany({
            where: {
                name: { startsWith: 'DOC01_' },
                clientLEId: clientLE.id,
            }
        });

        // Create test document and share it directly with the engagement
        const doc = await prisma.document.create({
            data: {
                name: testDocName,
                mimeType: 'application/pdf',
                sizeBytes: BigInt(2048),
                storageProvider: 'EXTERNAL_URL',
                storagePathname: 'https://example.com/test-doc.pdf',
                clientLEId: clientLE.id,
                sharedWith: {
                    connect: { id: engagement.id }
                }
            }
        });
        testDocId = doc.id;
    });

    test.afterAll(async () => {
        try {
            if (testDocId) {
                await prisma.document.delete({ where: { id: testDocId } }).catch(() => {});
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-29-64:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. ONP-29: Shared document is visible in Relationship Documents section with direct download action', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('domcontentloaded');

        // Expand supplier engagement card by clicking header
        const supplierHeader = page.locator('text="UAT Supplier Org A"').first();
        await expect(supplierHeader).toBeVisible({ timeout: 15000 });
        await supplierHeader.click();
        await page.waitForTimeout(1000);

        // Open inner Documents section
        const docsTrigger = page.locator('span.font-semibold:text-is("Documents")').first();
        await expect(docsTrigger).toBeVisible({ timeout: 15000 });
        await docsTrigger.click();
        await page.waitForTimeout(1000);

        // Click the "Shared" tab inside Documents
        const sharedTab = page.locator('button[role="tab"]:has-text("Shared"), [role="tab"]:has-text("Shared")').first();
        await expect(sharedTab).toBeVisible({ timeout: 10000 });
        await sharedTab.click();

        // Assert shared document is visible in Documents section
        const docRow = page.locator(`text="${testDocName}"`).first();
        await expect(docRow).toBeVisible({ timeout: 15000 });

        // Assert download link is present and targets the download API
        const downloadLink = page.locator(`a[href*="/api/documents/${testDocId}/download"]`).first();
        await expect(downloadLink).toBeVisible({ timeout: 10000 });
    });

    test('2. ONP-64: Output Pack displays supporting document with direct individual download link without requiring ZIP', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('domcontentloaded');

        // Expand supplier engagement card by clicking header
        const supplierHeader = page.locator('text="UAT Supplier Org A"').first();
        await expect(supplierHeader).toBeVisible({ timeout: 15000 });
        await supplierHeader.click();
        await page.waitForTimeout(1000);

        // Open inner Output section
        const outputTrigger = page.locator('span.font-semibold:text-is("Output")').first();
        await expect(outputTrigger).toBeVisible({ timeout: 15000 });
        await outputTrigger.click();
        await page.waitForTimeout(1000);

        // Assert Supporting Documents list contains our document
        const docEntry = page.locator(`text="${testDocName}"`).first();
        await expect(docEntry).toBeVisible({ timeout: 15000 });

        // Assert individual download button exists on the document row in Output Pack
        const individualDownloadBtn = page.locator(`a[href*="/api/documents/${testDocId}/download"]`).last();
        await expect(individualDownloadBtn).toBeVisible({ timeout: 10000 });

        // Verify direct download API response
        const res = await page.request.get(`/api/documents/${testDocId}/download`);
        expect(res.status()).not.toBe(401);
        expect(res.status()).not.toBe(403);
    });
});
