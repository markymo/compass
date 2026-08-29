import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

/**
 * Contract: REL-01
 * Linear Issue: ONP-67
 *
 * Requirements:
 * An authorised FI/Supplier user on the Workbench / Questions & Answers surface
 * must see all active authorized relationships in the relationship selector/filter,
 * even when a relationship has zero assigned/shared questions.
 */

test.describe('REL-01 / ONP-67 — FI Workbench lists all authorised active relationships', () => {
    test.use({
        storageState: path.join(process.cwd(), 'playwright/.auth/supplier-org-admin-a.json')
    });

    let prisma: PrismaClient;
    let supplierOrgId: string;
    let alphaEngagementId: string;
    let betaEngagementId: string;
    let disposableQnrId: string | null = null;

    test.beforeAll(async () => {
        prisma = new PrismaClient();

        // 1. Resolve Supplier Org Admin user & organization
        const supplierUser = await prisma.user.findFirst({
            where: { email: 'uat+supplier-org-admin@onpro.tech' },
            include: { memberships: { include: { organization: true } } }
        });

        const supplierMembership = supplierUser?.memberships.find(m =>
            m.organization?.types.some(t => ['FI', 'SUPPLIER', 'LAW_FIRM'].includes(t))
        );

        if (!supplierMembership?.organizationId) {
            throw new Error('Could not find supplier organization membership for uat+supplier-org-admin@onpro.tech');
        }

        supplierOrgId = supplierMembership.organizationId;

        // 2. Confirm both active relationships exist for UAT Supplier Org A
        const engagements = await prisma.fIEngagement.findMany({
            where: {
                fiOrgId: supplierOrgId,
                isDeleted: false,
                clientLE: { isDeleted: false }
            },
            include: { clientLE: true }
        });

        const alphaEng = engagements.find(e => e.clientLE.name === 'UAT Alpha Limited');
        const betaEng = engagements.find(e => e.clientLE.name === 'UAT Beta Limited');

        if (!alphaEng || !betaEng) {
            throw new Error(`Expected active engagements for both UAT Alpha Limited and UAT Beta Limited, found: ${engagements.map(e => e.clientLE.name).join(', ')}`);
        }

        alphaEngagementId = alphaEng.id;
        betaEngagementId = betaEng.id;

        // 3. Ensure Alpha has at least one questionnaire with questions so one relationship has questions and Beta has 0 questions
        const alphaQ = await prisma.questionnaire.create({
            data: {
                name: `REL01 Workbench Alpha ${Date.now()}`,
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                status: 'ACTIVE',
                isDeleted: false,
                isTemplate: false,
                questions: {
                    create: [
                        {
                            text: 'Alpha Test Legal Name',
                            status: 'SHARED',
                            sharedAt: new Date(),
                            expectedDataType: 'TEXT',
                            answer: 'UAT Alpha Limited',
                            order: 1
                        }
                    ]
                }
            }
        });
        disposableQnrId = alphaQ.id;
    });

    test.afterAll(async () => {
        if (disposableQnrId && prisma) {
            await prisma.question.deleteMany({ where: { questionnaireId: disposableQnrId } });
            await prisma.questionnaire.deleteMany({ where: { id: disposableQnrId } });
        }
        if (prisma) {
            await prisma.$disconnect();
        }
    });

    test('Workbench UI presents all active relationships in filter -> Alpha and Beta both selectable -> reload preserves both', async ({ page }) => {
        // 1. Enter the current Workbench / Questions & Answers surface
        await page.goto(`/app/s/${supplierOrgId}/questions`);
        await expect(page.getByRole('heading', { name: 'Questions & Answers' }).first()).toBeVisible({ timeout: 20000 });

        // 2. Identify and open the Relationship selector
        const getRelTrigger = () => page.locator('button[role="combobox"]').first();
        await expect(getRelTrigger()).toBeVisible();
        await getRelTrigger().click();

        // 3. Assert BOTH UAT Alpha Limited and UAT Beta Limited are available options
        const alphaOption = page.getByRole('option', { name: 'UAT Alpha Limited' });
        const betaOption = page.getByRole('option', { name: 'UAT Beta Limited' });

        await expect(alphaOption).toBeVisible();
        await expect(betaOption).toBeVisible();

        // 4. Select UAT Alpha Limited and confirm Workbench displays Alpha questions
        await alphaOption.click();
        await expect(page).toHaveURL(/rel=UAT(\+|%20)Alpha(\+|%20)Limited/);
        await expect(page.getByText('UAT Alpha Limited').first()).toBeVisible();

        // 5. Select UAT Beta Limited (zero questions relationship) and confirm Workbench handles clean empty state
        await getRelTrigger().click();
        await expect(betaOption).toBeVisible();
        await betaOption.click();
        await expect(page).toHaveURL(/rel=UAT(\+|%20)Beta(\+|%20)Limited/);
        // Verify Workbench remains functional without crash / 404
        await expect(page.getByRole('heading', { name: 'Questions & Answers' }).first()).toBeVisible();
        await expect(page.getByText('404')).not.toBeVisible();

        // 6. Reload the page and assert both relationship options remain available in the filter
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Questions & Answers' }).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('404')).not.toBeVisible();

        await expect(getRelTrigger()).toBeVisible();
        await getRelTrigger().click();

        await expect(page.getByRole('option', { name: 'UAT Alpha Limited' })).toBeVisible();
        await expect(page.getByRole('option', { name: 'UAT Beta Limited' })).toBeVisible();
    });
});
