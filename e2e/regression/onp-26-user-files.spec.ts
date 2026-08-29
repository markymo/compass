import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: FILE-01 — User Files upload lifecycle works
// Linear: ONP-26

const prisma = new PrismaClient();

test.describe('FILE-01 / ONP-26 — User Files Upload Lifecycle', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let tempFilePath: string;
    const testTimestamp = Date.now();
    const testFilename = `test_file_${testTimestamp}.pdf`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;

        // Create a valid small dummy PDF fixture
        tempFilePath = path.join(process.cwd(), 'scratch', testFilename);
        if (!fs.existsSync(path.dirname(tempFilePath))) {
            fs.mkdirSync(path.dirname(tempFilePath), { recursive: true });
        }
        // Minimal valid PDF content
        const pdfContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF`;
        fs.writeFileSync(tempFilePath, pdfContent);
    });

    test.afterAll(async () => {
        try {
            // Remove local temp fixture
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            // Cleanup created document records and intents
            if (clientLEId) {
                const docs = await prisma.document.findMany({
                    where: { clientLEId, name: { contains: `${testTimestamp}` } }
                });
                for (const doc of docs) {
                    await prisma.fieldClaim.deleteMany({ where: { attachmentDocumentId: doc.id } });
                    await prisma.privateDocumentUploadIntent.deleteMany({ where: { documentId: doc.id } });
                    await prisma.document.delete({ where: { id: doc.id } });
                }
                await prisma.privateDocumentUploadIntent.deleteMany({
                    where: { clientLEId, storagePathname: { contains: `${testTimestamp}` } }
                });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-26:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Permitted file uploaded through User Files UI persists, opens in drawer, and downloads valid binary', async ({ page }) => {
        // Step 1: Navigate to User Files page
        await page.goto(`/app/le/${clientLEId}/sources/user-files`);
        await page.waitForLoadState('networkidle');

        // Step 2: Locate file input and upload fixture
        const fileInput = page.locator('input[type="file"]').first();
        await expect(fileInput).toBeAttached({ timeout: 15000 });
        await fileInput.setInputFiles(tempFilePath);

        // Step 3: Assert upload success toast
        await expect(page.locator('text=Document uploaded successfully').first()).toBeVisible({ timeout: 30000 });

        // Step 4: Verify filename appears in the User Files table
        const fileRow = page.locator('tr').filter({ hasText: testFilename }).first();
        await expect(fileRow).toBeVisible({ timeout: 15000 });

        // Step 5: Click the row to open Document Detail Drawer
        await fileRow.click();
        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });
        await expect(drawer).toContainText(testFilename);
        await expect(drawer).toContainText('Metadata');

        // Close drawer
        await page.keyboard.press('Escape');

        // Step 6: Reload page and confirm persistence in fresh context
        await page.reload();
        await page.waitForLoadState('networkidle');

        const reloadedRow = page.locator('tr').filter({ hasText: testFilename }).first();
        await expect(reloadedRow).toBeVisible({ timeout: 15000 });

        // Step 7: Download and verify actual file download payload
        const downloadPromise = page.waitForEvent('download');
        await reloadedRow.locator('a[href*="/api/documents/"]').click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe(testFilename);
        const downloadedPath = await download.path();
        expect(downloadedPath).toBeTruthy();
        if (downloadedPath) {
            const downloadedSize = fs.statSync(downloadedPath).size;
            expect(downloadedSize).toBeGreaterThan(0);
        }
    });
});
