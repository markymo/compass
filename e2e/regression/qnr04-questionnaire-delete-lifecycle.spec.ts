import { test, expect, Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QNR-04
// Linear: ONP-70 — deleted questionnaire lifecycle across active relationship surfaces

const prisma = new PrismaClient();

async function expandAccordion(trigger: Locator) {
    await expect(trigger).toBeVisible({ timeout: 20000 });
    const state = await trigger.getAttribute('data-state');
    if (state === 'closed') {
        await trigger.click();
        try {
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 3000 });
        } catch {
            // Retry click if React hydration dropped initial synthetic click
            await trigger.click();
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 10000 });
        }
    }
}

test.describe('QNR-04 / ONP-70 — Questionnaire Delete Lifecycle Across Active Relationship Surfaces', () => {
    test.setTimeout(120000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let alphaClientLEId: string;
    let supplierOrgId: string;
    let alphaEngagementId: string;
    let disposableQId: string;
    let baselineQId: string;
    const testQName = `QNR04 Lifecycle Test Q ${Date.now()}`;
    const baselineQName = `QNR04 Baseline Unrelated Q ${Date.now()}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        alphaClientLEId = manifest.alphaClientLE.id;
        supplierOrgId = manifest.supplierOrgA.id;
        alphaEngagementId = manifest.relationshipAlpha.id;

        // 1. Create a baseline unrelated questionnaire to verify it remains unaffected when another is deleted
        const baselineQ = await prisma.questionnaire.create({
            data: {
                name: baselineQName,
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                status: 'ACTIVE',
                isDeleted: false,
                isTemplate: false,
                questions: {
                    create: [
                        {
                            text: 'Baseline persistent question',
                            status: 'SHARED',
                            order: 1
                        }
                    ]
                }
            }
        });
        baselineQId = baselineQ.id;

        // 2. Create disposable active questionnaire attached to relationshipAlpha
        const disposableQ = await prisma.questionnaire.create({
            data: {
                name: testQName,
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                status: 'ACTIVE',
                isDeleted: false,
                isTemplate: false,
                questions: {
                    create: [
                        {
                            text: 'Sample question to be deleted',
                            status: 'SHARED',
                            order: 1
                        }
                    ]
                }
            }
        });
        disposableQId = disposableQ.id;
    });

    test.afterAll(async () => {
        // Cleanup fixtures
        if (disposableQId) {
            await prisma.question.deleteMany({ where: { questionnaireId: disposableQId } });
            await prisma.questionnaire.deleteMany({ where: { id: disposableQId } });
        }
        if (baselineQId) {
            await prisma.question.deleteMany({ where: { questionnaireId: baselineQId } });
            await prisma.questionnaire.deleteMany({ where: { id: baselineQId } });
        }
        await prisma.$disconnect();
    });

    test('Full QNR-04 lifecycle: Client visible -> Supplier visible -> Client removes via UI -> Absent across surfaces -> Unrelated unaffected -> Soft-deleted record retained', async ({ browser }) => {
        // =========================================================================
        // Step 1: Confirm initially visible on Client Relationships surface
        // =========================================================================
        const clientContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const clientPage = await clientContext.newPage();

        await clientPage.goto(`/app/le/${alphaClientLEId}/relationships`);
        await expect(clientPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        // Expand Supplier relationship accordion
        const engagementTrigger = clientPage.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(engagementTrigger);

        // Expand Questionnaires sub-accordion
        const qTrigger = clientPage.getByRole('button', { name: /Questionnaires/i }).first();
        await expandAccordion(qTrigger);

        // Both disposable and baseline questionnaires must be visible initially on Client UI
        await expect(clientPage.getByText(testQName).first()).toBeVisible({ timeout: 20000 });
        await expect(clientPage.getByText(baselineQName).first()).toBeVisible({ timeout: 20000 });

        // =========================================================================
        // Step 2: Confirm initially visible on Supplier Relationships surface
        // =========================================================================
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const supplierPage = await supplierContext.newPage();

        // Navigate with targeted expand parameter for alphaEngagementId
        await supplierPage.goto(`/app/s/${supplierOrgId}?expand=${alphaEngagementId}`);
        await expect(supplierPage.getByRole('heading', { name: /Client Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        // If LE row collapsible is not auto-expanded, expand it
        const leRowHeader = supplierPage.locator('div').filter({ hasText: 'UAT Alpha Limited' }).last();
        const leChevron = leRowHeader.locator('button').first();
        if (await leChevron.isVisible()) {
            const hasDisposableQ = await supplierPage.getByText(testQName).isVisible();
            if (!hasDisposableQ) {
                await leChevron.click();
            }
        }

        // Both disposable and baseline questionnaires must be visible initially on Supplier UI
        await expect(supplierPage.getByText(testQName).first()).toBeVisible({ timeout: 20000 });
        await expect(supplierPage.getByText(baselineQName).first()).toBeVisible({ timeout: 20000 });

        // =========================================================================
        // Step 3: Client removes disposable questionnaire using supported UI action
        // No DB mutation fallback — must execute and succeed purely through UI
        // =========================================================================
        // Target specifically the individual questionnaire row for testQName
        const targetQRow = clientPage.locator('.group\\/card').filter({ hasText: testQName }).first();
        await expect(targetQRow).toBeVisible({ timeout: 15000 });

        const removeButton = targetQRow.locator('button[title="Remove Questionnaire"]').first();
        await expect(removeButton).toBeVisible({ timeout: 15000 });
        await removeButton.click();

        // Confirmation button "Yes" must appear within target row and be clicked
        const confirmBtn = targetQRow.getByRole('button', { name: /^Yes$/i }).first();
        await expect(confirmBtn).toBeVisible({ timeout: 10000 });
        await confirmBtn.click();

        // Verified immediate removal of disposable questionnaire from Client UI
        await expect(clientPage.getByText(testQName)).toHaveCount(0, { timeout: 15000 });
        // Baseline questionnaire remains untouched
        await expect(clientPage.getByText(baselineQName).first()).toBeVisible();

        // =========================================================================
        // Step 4: Verify persistent absence after Client page reload
        // =========================================================================
        await clientPage.reload();
        await expect(clientPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });
        const reloadedEngTrigger = clientPage.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(reloadedEngTrigger);
        const reloadedQTrigger = clientPage.getByRole('button', { name: /Questionnaires/i }).first();
        await expandAccordion(reloadedQTrigger);

        // Deleted questionnaire is NOT present in DOM
        await expect(clientPage.getByText(testQName)).toHaveCount(0);
        // Unrelated baseline questionnaire REMAINS visible
        await expect(clientPage.getByText(baselineQName).first()).toBeVisible();

        // =========================================================================
        // Step 5: Verify fresh Client browser context
        // =========================================================================
        const freshClientContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const freshClientPage = await freshClientContext.newPage();
        await freshClientPage.goto(`/app/le/${alphaClientLEId}/relationships`);
        await expect(freshClientPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });
        const freshEngTrigger = freshClientPage.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(freshEngTrigger);
        const freshQTrigger = freshClientPage.getByRole('button', { name: /Questionnaires/i }).first();
        await expandAccordion(freshQTrigger);
        await expect(freshClientPage.getByText(testQName)).toHaveCount(0);
        await expect(freshClientPage.getByText(baselineQName).first()).toBeVisible();

        // =========================================================================
        // Step 6: Verify Supplier portal surface post-deletion
        // =========================================================================
        await supplierPage.reload();
        await expect(supplierPage.getByRole('heading', { name: /Client Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        const reloadedSupplierLeRow = supplierPage.locator('div').filter({ hasText: 'UAT Alpha Limited' }).last();
        const reloadedSupplierChevron = reloadedSupplierLeRow.locator('button').first();
        if (await reloadedSupplierChevron.isVisible()) {
            const hasBaselineQ = await supplierPage.getByText(baselineQName).isVisible();
            if (!hasBaselineQ) {
                await reloadedSupplierChevron.click();
            }
        }

        // Deleted questionnaire is absent from Supplier UI
        await expect(supplierPage.getByText(testQName)).toHaveCount(0);
        // Baseline questionnaire remains visible on Supplier UI
        await expect(supplierPage.getByText(baselineQName).first()).toBeVisible({ timeout: 10000 });

        // =========================================================================
        // Step 7: Verify Database Record is soft-deleted, not destroyed
        // =========================================================================
        const dbQ = await prisma.questionnaire.findUnique({
            where: { id: disposableQId },
            select: { id: true, isDeleted: true, fiEngagementId: true }
        });
        expect(dbQ).not.toBeNull();
        expect(dbQ?.isDeleted).toBe(true);

        await clientContext.close();
        await freshClientContext.close();
        await supplierContext.close();
    });
});
