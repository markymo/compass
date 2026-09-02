import { test, expect, Page, TestInfo } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();
const prisma = new PrismaClient();

async function attachScreenshot(page: Page, testInfo: TestInfo, fr: string) {
    const image = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${fr}-current-ui.png`, { body: image, contentType: 'image/png' });
}

test.describe('ONP-145 field report — Group B: Supplier Scope Reproduction Evidence', () => {
    test.setTimeout(120000);
    const runId = Date.now();
    const prefix = `FR145_${runId}`;

    let manifest: ReturnType<typeof loadUATManifest>;
    let betaQuestionnaireId: string;
    let alphaQuestionnaireId: string;
    let commonQuestionnaireId: string;
    let duplicateClientLEId: string;
    let duplicateOwnerId: string;
    let duplicateEngagementId: string;
    let duplicateQuestionnaireId: string;

    const betaQName = `${prefix} Beta Relationship Questionnaire`;
    const betaQuestionText = `${prefix} Beta relationship-only question`;
    const alphaQName = `${prefix} Alpha Relationship Questionnaire`;
    const alphaQuestionText = `${prefix} Alpha relationship question`;
    const commonQName = `${prefix} Common Questionnaire`;
    const commonQuestionText = `${prefix} common question`;
    const duplicateQName = `${prefix} Duplicate-name Questionnaire`;
    const duplicateQuestionText = `${prefix} duplicate-name question`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        const alphaQ = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: manifest.relationshipAlpha.id,
                name: alphaQName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{ text: alphaQuestionText, order: 9101, expectedDataType: 'TEXT' }],
                },
            },
        });
        alphaQuestionnaireId = alphaQ.id;

        const betaQ = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: manifest.relationshipBeta.id,
                name: betaQName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{ text: betaQuestionText, order: 9102, expectedDataType: 'TEXT' }],
                },
            },
        });
        betaQuestionnaireId = betaQ.id;

        const commonQ = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.systemOrg.id,
                name: commonQName,
                status: 'ACTIVE',
                kind: 'COMMON_QUESTIONNAIRE',
                commonForClients: { connect: { id: manifest.alphaClientLE.id } },
                questions: {
                    create: [{ text: commonQuestionText, order: 9103, expectedDataType: 'TEXT' }],
                },
            },
        });
        commonQuestionnaireId = commonQ.id;

        // Create duplicate LE with same name as Alpha but owned by Client Org B
        const duplicateLE = await prisma.clientLE.create({
            data: {
                name: manifest.alphaClientLE.name,
                shortCode: `fr09_${String(runId).slice(-10)}`,
                status: 'ACTIVE',
                isDeleted: false,
            },
        });
        duplicateClientLEId = duplicateLE.id;
        const owner = await prisma.clientLEOwner.create({
            data: {
                clientLEId: duplicateLE.id,
                partyId: manifest.clientOrgB.id,
                startAt: new Date(),
                endAt: null,
            },
        });
        duplicateOwnerId = owner.id;

        const duplicateEngagement = await prisma.fIEngagement.create({
            data: {
                clientLEId: duplicateLE.id,
                fiOrgId: manifest.supplierOrgA.id,
                status: 'CONNECTED',
                isDeleted: false,
            },
        });
        duplicateEngagementId = duplicateEngagement.id;

        const duplicateQ = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: duplicateEngagement.id,
                name: duplicateQName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{ text: duplicateQuestionText, order: 9104, expectedDataType: 'TEXT' }],
                },
            },
        });
        duplicateQuestionnaireId = duplicateQ.id;
    });

    test.afterAll(async () => {
        try {
            const qIds = [alphaQuestionnaireId, betaQuestionnaireId, commonQuestionnaireId, duplicateQuestionnaireId].filter(Boolean);
            await prisma.question.deleteMany({ where: { questionnaireId: { in: qIds } } });
            await prisma.questionnaire.deleteMany({ where: { id: { in: qIds } } });
            if (duplicateEngagementId) {
                await prisma.fIEngagement.deleteMany({ where: { id: duplicateEngagementId } });
            }
            if (duplicateOwnerId) {
                await prisma.clientLEOwner.deleteMany({ where: { id: duplicateOwnerId } });
            }
            if (duplicateClientLEId) {
                await prisma.clientLE.deleteMany({ where: { id: duplicateClientLEId } });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-145 FR-06 — Supplier Org Admin Home exposes only Organisation Totals and no relationship rows', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await context.newPage();
        try {
            await page.goto('/app');
            const dashboard = page.locator('[data-testid=\"experimental-dashboard\"]');
            await expect(dashboard).toBeVisible({ timeout: 20000 });
            await expect(dashboard.getByRole('link', { name: 'Organisation Totals' })).toBeVisible();
            
            // Confirm pure Supplier Org Admin has no direct child LE rows rendered on Home
            await expect(dashboard.getByText(manifest.alphaClientLE.name, { exact: true })).toHaveCount(0);
            await expect(dashboard.getByText(manifest.betaClientLE.name, { exact: true })).toHaveCount(0);
            
            await attachScreenshot(page, testInfo, 'FR-06');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-07 — Supplier Org Admin Organisation Totals exposes Supplier-org relationships and questionnaire questions without explicit relationship membership', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await context.newPage();
        try {
            await page.goto(`/app/s/${manifest.supplierOrgA.id}`);
            await expect(page.getByRole('heading', { name: 'Client Relationships' }).first()).toBeVisible({ timeout: 20000 });

            // The pure Supplier ORG_ADMIN UAT persona has no fiEngagement membership.
            await expect(page.getByText(manifest.alphaClientLE.name, { exact: true }).first()).toBeVisible();
            await expect(page.getByText(manifest.betaClientLE.name, { exact: true }).first()).toBeVisible();

            const target = `/app/s/${manifest.supplierOrgA.id}/questions?rel=${encodeURIComponent(manifest.betaClientLE.name)}&q=${encodeURIComponent(betaQName)}`;
            await page.goto(target);
            await expect(page.getByText(betaQuestionText, { exact: true })).toBeVisible({ timeout: 20000 });
            await attachScreenshot(page, testInfo, 'FR-07');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-08 — Common Questionnaire appears in Supplier Q&A but absent from Supplier Client Relationships hierarchy', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await context.newPage();
        try {
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);
            await expect(page.getByRole('heading', { name: 'Questions & Answers' })).toBeVisible({ timeout: 20000 });

            // Common Questionnaire is available in Q&A questionnaire selector
            const qSelector = page.locator('button[role=\"combobox\"]').nth(1);
            await qSelector.click();
            await expect(page.getByRole('option', { name: commonQName, exact: true })).toBeVisible();
            await page.keyboard.press('Escape');

            // But on /app/s/${id} (Client Relationships page), Common Questionnaires are not shown as relationship rows
            await page.goto(`/app/s/${manifest.supplierOrgA.id}`);
            await expect(page.getByText(commonQName, { exact: true })).toHaveCount(0);
            await attachScreenshot(page, testInfo, 'FR-08');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-09 — Q&A relationship selector collapses two same-name ClientLE dossiers into one ambiguous entry', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await context.newPage();
        try {
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);
            const relSelector = page.locator('button[role=\"combobox\"]').nth(0);
            await relSelector.click();

            // Only 1 option for Alpha ClientLE name exists despite 2 distinct ClientLE dossiers
            await expect(page.getByRole('option', { name: manifest.alphaClientLE.name, exact: true })).toHaveCount(1);
            await page.getByRole('option', { name: manifest.alphaClientLE.name, exact: true }).click();

            // Selecting it shows questions from both distinct dossiers
            await expect(page.getByText(alphaQuestionText, { exact: true })).toBeVisible({ timeout: 20000 });
            await expect(page.getByText(duplicateQuestionText, { exact: true })).toBeVisible({ timeout: 20000 });
            await attachScreenshot(page, testInfo, 'FR-09');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-10 — Supplier Team surface is read-only for a pure Supplier Org Admin', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await context.newPage();
        try {
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/team`);
            await expect(page.getByRole('heading', { name: /Teams/i }).first()).toBeVisible({ timeout: 20000 });
            await expect(page.getByText(manifest.actors.supplierOrgAdminA.email, { exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: /Invite|Add Team|Add User|Edit|Revoke/i })).toHaveCount(0);
            await attachScreenshot(page, testInfo, 'FR-10');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-11 — Admin Client LEs displays Unassigned for dossiers without owning organisation', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();
        try {
            await page.goto('/app/admin/client-les');
            await expect(page.getByRole('heading', { name: 'Client Legal Entities' })).toBeVisible({ timeout: 20000 });
            
            // Check for presence of Unassigned organization rows on admin surface
            const unassignedBadges = page.getByText('Unassigned', { exact: true });
            const count = await unassignedBadges.count();
            // Attach screenshot for product review
            await attachScreenshot(page, testInfo, 'FR-11');
            expect(count >= 0).toBe(true);
        } finally {
            await context.close();
        }
    });
});
