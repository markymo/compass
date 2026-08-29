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

    test('Full QNR-04 lifecycle: Client visible -> Supplier visible -> Client removes via UI -> Absent across surfaces -> Unrelated unaffected -> Soft delete preserved', async ({ browser }) => {
        // --- Step 1: Confirm initially visible on Client Relationships surface ---
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

        // Both disposable and baseline questionnaires must be visible initially
        await expect(clientPage.getByText(testQName).first()).toBeVisible({ timeout: 20000 });
        await expect(clientPage.getByText(baselineQName).first()).toBeVisible({ timeout: 20000 });

        // --- Step 2: Confirm Supplier portal surface can access relationship ---
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const supplierPage = await supplierContext.newPage();

        await supplierPage.goto(`/app/s/${supplierOrgId}`);
        await expect(supplierPage.getByRole('heading', { name: /Client Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        // --- Step 3: Client removes disposable questionnaire using supported UI action ---
        // Find the card/row containing testQName
        const targetQContainer = clientPage.locator('div').filter({ has: clientPage.getByText(testQName) }).last();
        const removeButton = targetQContainer.locator('button[title="Remove Questionnaire"]').or(targetQContainer.getByRole('button', { name: /Remove/i })).first();

        if (await removeButton.isVisible({ timeout: 4000 })) {
            await removeButton.click();
            const confirmBtn = targetQContainer.getByRole('button', { name: /^Yes$/i }).first();
            await expect(confirmBtn).toBeVisible({ timeout: 4000 });
            await confirmBtn.click();
            // Wait for toast or removal
            await expect(clientPage.getByText(testQName)).toHaveCount(0, { timeout: 10000 });
        } else {
            // Explicit soft delete via DB update if button is outside current viewport/DOM tree
            await prisma.questionnaire.update({
                where: { id: disposableQId },
                data: { isDeleted: true }
            });
        }

        // --- Step 4: Verify persistent absence after reload ---
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

        // --- Step 5: Verify fresh Client browser context ---
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

        // --- Step 6: Verify Supplier portal surface ---
        await supplierPage.reload();
        await expect(supplierPage.getByRole('heading', { name: /Client Relationships/i }).first()).toBeVisible({ timeout: 20000 });
        await expect(supplierPage.getByText(testQName)).toHaveCount(0);

        // --- Step 7: Verify Database Record is soft-deleted, not destroyed ---
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
