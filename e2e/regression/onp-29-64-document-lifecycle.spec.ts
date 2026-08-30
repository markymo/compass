import { test, expect, Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { del } from '@vercel/blob';
import * as fs from 'fs';
import * as path from 'path';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

async function expandAccordion(trigger: Locator) {
    await expect(trigger).toBeVisible({ timeout: 20000 });
    const state = await trigger.getAttribute('data-state');
    if (state === 'closed') {
        await trigger.click();
        try {
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 3000 });
        } catch {
            await trigger.click();
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 10000 });
        }
    }
}

// Contract: DOC-01 — A relationship document that the entitled user can see can be directly opened/downloaded as an individual file, and the corresponding Output Pack/Documents surfaces agree.
// Linear: ONP-29, ONP-64

const prisma = new PrismaClient();

test.describe('DOC-01 / ONP-29 + ONP-64 — Relationship Document & Output Pack Direct Download Flow', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(120000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let engagementId: string;
    let testDocId: string;
    let storagePathname: string | undefined;
    let tempFilePath: string;

    const testTimestamp = Date.now();
    const testFilename = `DOC01_Rel_Doc_${testTimestamp}.pdf`;
    const pdfPayloadString = `%PDF-1.4\n% DOC-01 Test Payload ${testTimestamp}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF`;

    test.beforeAll(async ({ browser }) => {
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

        // Step 1: Create local PDF file fixture
        tempFilePath = path.join(process.cwd(), 'scratch', testFilename);
        if (!fs.existsSync(path.dirname(tempFilePath))) {
            fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
        }
        fs.writeFileSync(tempFilePath, pdfPayloadString);

        // Step 2: Upload genuine VERCEL_BLOB document via User Files UI
        const setupContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const setupPage = await setupContext.newPage();
        try {
            await setupPage.goto(`/app/le/${clientLEId}/sources/user-files`);
            await setupPage.waitForLoadState('domcontentloaded');

            const fileInput = setupPage.locator('input[type="file"]').first();
            await expect(fileInput).toBeAttached({ timeout: 20000 });
            await fileInput.setInputFiles(tempFilePath);

            // Assert upload success toast
            await expect(setupPage.locator('text=Document uploaded successfully').first()).toBeVisible({ timeout: 40000 });

            // Verify document record persisted in DB
            const createdDoc = await prisma.document.findFirst({
                where: { clientLEId, name: testFilename, isDeleted: false }
            });
            if (!createdDoc) throw new Error(`Document ${testFilename} was not persisted in database after upload`);
            testDocId = createdDoc.id;
            storagePathname = createdDoc.storagePathname;

            // Step 3: Explicitly share this genuine document with the supplier engagement
            await prisma.fIEngagement.update({
                where: { id: engagementId },
                data: {
                    sharedDocuments: {
                        connect: { id: testDocId }
                    }
                }
            });
        } finally {
            await setupPage.close();
            await setupContext.close();
        }
    });

    test.afterAll(async () => {
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            let blobPathToDelete = storagePathname;
            if (testDocId) {
                if (!blobPathToDelete) {
                    const doc = await prisma.document.findUnique({ where: { id: testDocId } }).catch(() => null);
                    if (doc?.storagePathname) blobPathToDelete = doc.storagePathname;
                }
                if (engagementId) {
                    await prisma.fIEngagement.update({
                        where: { id: engagementId },
                        data: { sharedDocuments: { disconnect: { id: testDocId } } }
                    }).catch(() => {});
                }
                // Non-destructive cleanup: delete only the exact document created by this test run
                await prisma.fieldClaim.deleteMany({ where: { attachmentDocumentId: testDocId } }).catch(() => {});
                await prisma.privateDocumentUploadIntent.deleteMany({ where: { documentId: testDocId } }).catch(() => {});
                await prisma.document.delete({ where: { id: testDocId } }).catch(() => {});
            }
            if (blobPathToDelete) {
                const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
                if (token) {
                    await del(blobPathToDelete, { token }).catch((err) => {
                        console.warn('Warning deleting test blob from Vercel Blob:', blobPathToDelete, err);
                    });
                }
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-29-64:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. ONP-29: Shared document in Relationship Documents executes browser download with 200, matching Content-Disposition, and verified binary content', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('domcontentloaded');

        // Locate and expand supplier engagement card
        const supplierHeaderBtn = page.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(supplierHeaderBtn);

        const docsTrigger = page.getByRole('button', { name: /Documents/i }).first();
        await expandAccordion(docsTrigger);

        // Click the "Shared" tab inside Documents
        const sharedTab = page.locator('button[role="tab"]:has-text("Shared"), [role="tab"]:has-text("Shared")').first();
        await expect(sharedTab).toBeVisible({ timeout: 10000 });
        await sharedTab.click();

        // Assert shared document row is visible in Documents section
        const docRow = page.locator(`text="${testFilename}"`).first();
        await expect(docRow).toBeVisible({ timeout: 15000 });

        // Locate download action link for this specific document
        const downloadLink = page.locator(`a[href*="/api/documents/${testDocId}/download"]`).first();
        await expect(downloadLink).toBeVisible({ timeout: 10000 });
        await expect(downloadLink).toHaveAttribute('href', `/api/documents/${testDocId}/download`);

        // Positive browser download assertion via real UI click
        const downloadPromise = page.waitForEvent('download');
        await downloadLink.click();
        const download = await downloadPromise;

        // Assert filename match
        expect(download.suggestedFilename()).toBe(testFilename);

        // Assert non-zero bytes and valid payload content from downloaded binary
        const downloadedPath = await download.path();
        expect(downloadedPath).toBeTruthy();
        if (downloadedPath) {
            const stat = fs.statSync(downloadedPath);
            expect(stat.size).toBeGreaterThan(0);
            const content = fs.readFileSync(downloadedPath, 'utf8');
            expect(content).toContain(`DOC-01 Test Payload ${testTimestamp}`);
        }

        // Direct API response headers and status verification
        const downloadRes = await page.request.get(`/api/documents/${testDocId}/download`);
        expect(downloadRes.status()).toBe(200);
        expect(downloadRes.headers()['content-type']).toContain('application/pdf');
        expect(downloadRes.headers()['content-disposition']).toContain(encodeURIComponent(testFilename));
        const resBody = await downloadRes.body();
        expect(resBody.length).toBeGreaterThan(0);
    });

    test('2. ONP-64: Output Pack Supporting Documents displays individual download action with 200, matching Content-Disposition, and verified binary content', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('domcontentloaded');

        // Locate and expand supplier engagement card
        const supplierHeaderBtn = page.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(supplierHeaderBtn);

        const outputTrigger = page.getByRole('button', { name: /Output/i }).first();
        await expandAccordion(outputTrigger);

        // Assert Supporting Documents list contains our document
        const docEntry = page.locator(`text="${testFilename}"`).first();
        await expect(docEntry).toBeVisible({ timeout: 15000 });

        // Assert individual download button exists on the document row in Output Pack
        const individualDownloadBtn = page.locator(`a[href*="/api/documents/${testDocId}/download"]`).last();
        await expect(individualDownloadBtn).toBeVisible({ timeout: 10000 });
        await expect(individualDownloadBtn).toHaveAttribute('href', `/api/documents/${testDocId}/download`);

        // Positive browser download assertion via real UI click
        const downloadPromise = page.waitForEvent('download');
        await individualDownloadBtn.click();
        const download = await downloadPromise;

        // Assert filename match
        expect(download.suggestedFilename()).toBe(testFilename);

        // Assert non-zero bytes and valid payload content from downloaded binary
        const downloadedPath = await download.path();
        expect(downloadedPath).toBeTruthy();
        if (downloadedPath) {
            const stat = fs.statSync(downloadedPath);
            expect(stat.size).toBeGreaterThan(0);
            const content = fs.readFileSync(downloadedPath, 'utf8');
            expect(content).toContain(`DOC-01 Test Payload ${testTimestamp}`);
        }

        // Direct API response headers and status verification
        const downloadRes = await page.request.get(`/api/documents/${testDocId}/download`);
        expect(downloadRes.status()).toBe(200);
        expect(downloadRes.headers()['content-type']).toContain('application/pdf');
        expect(downloadRes.headers()['content-disposition']).toContain(encodeURIComponent(testFilename));
        const resBody = await downloadRes.body();
        expect(resBody.length).toBeGreaterThan(0);
    });
});
