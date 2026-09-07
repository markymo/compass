import { test, expect, Page } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Ensure UAT environment is loaded
const envUatLocal = path.resolve(process.cwd(), '.env.uat.local');
if (fs.existsSync(envUatLocal)) {
    dotenv.config({ path: envUatLocal, override: false });
}

const DISPOSABLE_MEMBER_EMAIL = 'uat+onp170-supplier-member@onpro.tech';
const uatPassword = process.env.UAT_PASSWORD || 'Password123!';

async function login(page: Page, email: string, pass: string) {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(pass);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 });
}

test.describe('ONP-170 — Supplier Org Admin Permissions & Relationship Contract', () => {
    test.describe('Pure Supplier ORG_ADMIN', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });

        test('1. FR-07: Pure Supplier ORG_ADMIN is denied operational questionnaire and question data on Questions Workbench', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);

            // The Questions Workbench should show zero operational questions for pure ORG_ADMIN
            // It should render the empty state: "No questions found matching your filter criteria" or "0 questions"
            await expect(page.getByText(/0 questions|No questions found/i).first()).toBeVisible({ timeout: 15000 });

            // Operational question items should not be rendered
            const kanbanCards = page.locator('[data-testid="question-kanban-card"]');
            await expect(kanbanCards).toHaveCount(0);
        });

        test('2. Administrative Metadata: Pure Supplier ORG_ADMIN sees relationship identity and status without operational questionnaire leaf rows', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}`);

            await expect(page.getByRole('heading', { name: 'Client Relationships' }).first()).toBeVisible({ timeout: 15000 });

            // Identity and status should be visible
            await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
            await expect(page.getByText(manifest.betaClientLE.name).first()).toBeVisible();

            // Operational questionnaire review links should NOT be rendered for pure ORG_ADMIN
            const reviewLinks = page.getByRole('link', { name: /Review Questions/i });
            await expect(reviewLinks).toHaveCount(0);
        });

        test('3. Team Administration: Pure Supplier ORG_ADMIN can view Supplier Teams and access scopes', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/team`);

            await expect(page.getByRole('heading', { name: /Teams/i }).first()).toBeVisible({ timeout: 15000 });
            await expect(page.getByText(manifest.actors.supplierOrgAdminA.email)).toBeVisible();
            await expect(page.getByText(manifest.actors.relationshipAdminAlpha.email)).toBeVisible();
        });
    });

    test.describe('Assigned Relationship Admin Alpha', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });

        test('4. Assigned RELATIONSHIP_ADMIN can view operational questions for assigned relationship Alpha', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);

            await expect(page.getByRole('heading', { name: 'Questions & Answers' }).first()).toBeVisible({ timeout: 15000 });
            // Relationship Admin Alpha should have access to Questions Workbench
            await expect(page.getByText(/questions/i).first()).toBeVisible();
        });
    });

    test.describe('Pure Supplier ORG_MEMBER', () => {
        let prisma: PrismaClient;

        test.beforeAll(async () => {
            prisma = new PrismaClient();
            const passwordHash = await bcrypt.hash(uatPassword, 10);

            // Clean up any stale residue
            const existingUser = await prisma.user.findUnique({ where: { email: DISPOSABLE_MEMBER_EMAIL } });
            if (existingUser) {
                await prisma.membership.deleteMany({ where: { userId: existingUser.id } });
                await prisma.user.delete({ where: { id: existingUser.id } });
            }

            const manifest = loadUATManifest();
            const user = await prisma.user.create({
                data: {
                    email: DISPOSABLE_MEMBER_EMAIL,
                    name: 'ONP-170 Supplier Member',
                    password: passwordHash,
                }
            });

            await prisma.membership.create({
                data: {
                    userId: user.id,
                    organizationId: manifest.supplierOrgA.id,
                    role: 'ORG_MEMBER',
                }
            });
        });

        test.afterAll(async () => {
            if (prisma) {
                const user = await prisma.user.findUnique({ where: { email: DISPOSABLE_MEMBER_EMAIL } });
                if (user) {
                    await prisma.membership.deleteMany({ where: { userId: user.id } });
                    await prisma.user.delete({ where: { id: user.id } });
                }
                await prisma.$disconnect();
            }
        });

        test('5. Pure Supplier ORG_MEMBER with no Relationship membership receives zero relationships and zero operational data', async ({ page }) => {
            const manifest = loadUATManifest();
            await login(page, DISPOSABLE_MEMBER_EMAIL, uatPassword);

            // Navigate to relationships summary: must NOT see supplier-wide directory
            await page.goto(`/app/s/${manifest.supplierOrgA.id}`);
            await expect(page.getByRole('heading', { name: 'Client Relationships' }).first()).toBeVisible({ timeout: 15000 });
            await expect(page.getByText(/No Client Relationships are currently available/i)).toBeVisible();
            await expect(page.getByText(manifest.alphaClientLE.name)).toHaveCount(0);
            await expect(page.getByText(manifest.betaClientLE.name)).toHaveCount(0);

            // Navigate to questions workbench: must NOT receive operational questions
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);
            await expect(page.getByText(/0 questions|No questions found/i).first()).toBeVisible({ timeout: 15000 });
            const kanbanCards = page.locator('[data-testid="question-kanban-card"]');
            await expect(kanbanCards).toHaveCount(0);
        });
    });
});
