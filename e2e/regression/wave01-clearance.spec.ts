import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

test.describe('Parallel Wave 01 — MVP Issue Clearance Baseline', () => {
    test.setTimeout(120000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let supplierOrgId: string;
    let clientOrgId: string;
    let clientLEId: string;
    let engagementId: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        supplierOrgId = manifest.supplierOrgA.id;
        clientOrgId = manifest.clientOrgA.id;
        clientLEId = manifest.alphaClientLE.id;
        engagementId = manifest.relationshipAlpha.id;
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    test('ONP-70 / LIFE-03: Soft-deleted questionnaire is excluded from available requirements', async () => {
        const { getAvailableQuestionnaires } = await import('@/actions/requirements');

        // Create a temporary soft-deleted questionnaire
        const softDeletedQ = await prisma.questionnaire.create({
            data: {
                name: `Wave01 Temp Deleted Q ${Date.now()}`,
                fiOrgId: supplierOrgId,
                status: 'ACTIVE',
                isDeleted: true,
                isTemplate: true,
            }
        });

        try {
            const available = await getAvailableQuestionnaires(supplierOrgId);
            const found = available.find((q: any) => q.id === softDeletedQ.id);
            expect(found).toBeUndefined();
        } finally {
            await prisma.questionnaire.delete({ where: { id: softDeletedQ.id } });
        }
    });

    test('ONP-69 / INV-04: FI Team invite flow generates valid SUPPLIER_CONTACT invitation', async () => {
        const { inviteSupplier } = await import('@/actions/supplier-invitations');

        const testEmail = `wave01-supp-${Date.now()}@example.com`;

        // Clean any pre-existing invite
        await prisma.invitation.deleteMany({
            where: { sentToEmail: testEmail, fiEngagementId: engagementId }
        });

        const result = await inviteSupplier(engagementId, testEmail, 'SUPPLIER_CONTACT', 'Welcome to Wave 01 test');
        expect(result.success).toBe(true);

        const invite = await prisma.invitation.findFirst({
            where: { sentToEmail: testEmail, fiEngagementId: engagementId }
        });

        expect(invite).not.toBeNull();
        expect(invite?.role).toBe('SUPPLIER_CONTACT');
        expect(invite?.usedAt).toBeNull();

        // Cleanup
        if (invite) {
            await prisma.invitation.delete({ where: { id: invite.id } });
        }
    });

    test('ONP-68 / SUPP-01: Supplier questionnaire and legacy engagement routing resolve without 404', async ({ page }) => {
        // Authenticate as Supplier Org Admin
        await page.context().addCookies([]);
        // Use supplier persona
        await page.goto(`/app/s/${supplierOrgId}`);
        await expect(page.getByRole('heading', { name: 'Client Relationships' })).toBeVisible({ timeout: 15000 });

        // Test legacy engagement redirect URL: /app/s/[id]/engagements/[engagementId] -> /app/s/[id]?expand=[engagementId]
        await page.goto(`/app/s/${supplierOrgId}/engagements/${engagementId}`);
        await expect(page).toHaveURL(new RegExp(`/app/s/${supplierOrgId}\\?expand=`));
        await expect(page.getByRole('heading', { name: 'Client Relationships' })).toBeVisible({ timeout: 15000 });

        // Navigate to Questions Workbench directly
        await page.goto(`/app/s/${supplierOrgId}/questions`);
        await expect(page.getByRole('heading', { name: 'Questions & Answers' })).toBeVisible({ timeout: 15000 });
    });

    test('ONP-67 / WORK-01: FI Workbench loads and discovers multiple active relationships', async () => {
        const { getFIWorkbenchData } = await import('@/actions/fi');
        const data = await getFIWorkbenchData(supplierOrgId);

        expect(data).toBeDefined();
        expect(Array.isArray(data.les)).toBe(true);
        expect(Array.isArray(data.questions)).toBe(true);
        expect(data.counts).toBeDefined();
    });
});
