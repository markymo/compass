import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QNR-02 — Mappings and completion percentage are retained across questionnaire versions
// Linear: ONP-34

const prisma = new PrismaClient();

function executeFinalizeSubmission(questionnaireId: string, relationshipId: string, clientLEId: string, submittedById: string) {
    const cmd = `npx tsx -e "import { createQuestionnaireSubmission } from './src/services/submissionService'; createQuestionnaireSubmission({ questionnaireId: '${questionnaireId}', relationshipId: '${relationshipId}', clientLEId: '${clientLEId}', submittedById: '${submittedById}' }).then(r => { console.log(JSON.stringify(r)); process.exit(r.success ? 0 : 1); });"`;
    const output = execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    return JSON.parse(lastLine);
}

test.describe('QNR-02 / ONP-34 — Questionnaire Versioning Mappings & Completion Retention', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(120000);

    let supplierOrgId: string;
    let alphaEngagementId: string;
    let clientLEId: string;
    let subjectLeId: string | undefined;
    let testUser: any;
    let testQuestionnaire: any;
    let testQ1: any;
    let testQ2: any;
    let testQ3: any;
    let subResultV1: any;
    let subResultV2: any;

    const testPrefix = `QNR02 Versioning UI ${Date.now()}`;

    test.beforeAll(async () => {
        // Locate UAT alpha ClientLE and active engagement
        const clientLE = await prisma.clientLE.findFirst({
            where: { shortCode: 'uat_cle_alpha' }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');

        const engagement = await prisma.fIEngagement.findFirst({
            where: { clientLEId: clientLE.id, isDeleted: false }
        });
        if (!engagement) throw new Error(`Active engagement for ${clientLE.id} not found`);

        clientLEId = clientLE.id;
        subjectLeId = clientLE.legalEntityId || undefined;
        supplierOrgId = engagement.fiOrgId;
        alphaEngagementId = engagement.id;

        testUser = await prisma.user.findFirst({
            where: { email: 'uat+le-admin-alpha@onpro.tech' }
        });
        if (!testUser) throw new Error('uat+le-admin-alpha user not found');

        // 1. Create questionnaire attached to relationship
        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: `${testPrefix} QN`,
                description: 'E2E testing questionnaire version definition freezing and historical mapping retention',
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                engagements: { connect: { id: alphaEngagementId } }
            }
        });

        // 2. V1 Live Questions: Q1 -> F2 (Legal Name), Q2 -> F1 (LEI)
        testQ1 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'V1 Question 1 - Entity Legal Name',
                order: 1,
                masterFieldNo: 2,
                expectedDataType: 'TEXT',
                status: 'SHARED'
            }
        });

        testQ2 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'V1 Question 2 - Legal Entity Identifier (LEI)',
                order: 2,
                masterFieldNo: 1,
                expectedDataType: 'TEXT',
                status: 'SHARED'
            }
        });

        // 3. Set Master authoritative values for F2 and F1
        await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'QNR02_V1_CLAIM',
                valueText: 'Acme Apex Alpha Corp',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });

        await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 1,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'QNR02_V1_CLAIM',
                valueText: '5493006MHB84DD0ZWV18',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });

        // 4. Freeze V1 using supported submission service
        subResultV1 = executeFinalizeSubmission(testQuestionnaire.id, alphaEngagementId, clientLEId, testUser.id);
        if (!subResultV1.success) {
            throw new Error(`V1 Submission failed: ${subResultV1.error}`);
        }

        // 5. Mutate live questionnaire to create V2:
        // Update Q2 mapping to F78 (Companies House number) and add Q3
        await prisma.question.update({
            where: { id: testQ2.id },
            data: {
                text: 'V2 Question 2 - Companies House Registration Number',
                masterFieldNo: 78
            }
        });

        await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 78,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'QNR02_V2_CLAIM',
                valueText: '09876543',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });

        testQ3 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'V2 Question 3 - Primary Contact Note',
                order: 3,
                masterFieldNo: null,
                expectedDataType: 'TEXT',
                answer: 'Direct contact note for V2',
                status: 'SHARED'
            }
        });

        // 6. Freeze V2 using supported submission service
        subResultV2 = executeFinalizeSubmission(testQuestionnaire.id, alphaEngagementId, clientLEId, testUser.id);
        if (!subResultV2.success) {
            throw new Error(`V2 Submission failed: ${subResultV2.error}`);
        }
    });

    test.afterAll(async () => {
        try {
            if (testQuestionnaire?.id) {
                await prisma.submissionAnswerAttachment.deleteMany({ where: { submissionAnswer: { submission: { questionnaireId: testQuestionnaire.id } } } });
                await prisma.submissionAnswer.deleteMany({ where: { submission: { questionnaireId: testQuestionnaire.id } } });
                await prisma.questionnaireSubmission.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
                await prisma.questionDefinitionSnapshot.deleteMany({ where: { definitionVersion: { questionnaireId: testQuestionnaire.id } } });
                await prisma.questionnaireDefinitionVersion.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
                await prisma.question.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
                await prisma.questionnaire.deleteMany({ where: { id: testQuestionnaire.id } });
            }
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({ where: { clientLEId: clientLEId, sourceReference: { in: ['QNR02_V1_CLAIM', 'QNR02_V2_CLAIM'] } } });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-34:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Supported submission engine creates immutable definition versions and preserves historical mappings across versions', async () => {
        expect(subResultV1.versionNumber).toBe(1);
        expect(subResultV1.submissionNumber).toBe(1);
        expect(subResultV2.versionNumber).toBe(2);
        expect(subResultV2.submissionNumber).toBe(1);
    });

    test('2. UI displays separate historical definition versions and preserves exact frozen answers and mappings', async ({ page }) => {
        // Step 1: Navigate to Client LE questionnaire view
        await page.goto(`/app/le/${clientLEId}/v2/questionnaire/${testQuestionnaire.id}`);
        await page.waitForLoadState('networkidle');

        // Step 2: Click 'Approval History' tab
        const historyTabButton = page.getByRole('button', { name: /Approval History/i });
        await expect(historyTabButton).toBeVisible({ timeout: 15000 });
        await historyTabButton.click();
        await page.waitForLoadState('networkidle');

        // Step 3: Assert both definition versions appear in the UI with their question counts & snapshot metrics
        const version2Card = page.locator('.border-slate-200, .card').filter({ hasText: 'Questionnaire Definition Version 2' }).first();
        await expect(version2Card).toBeVisible({ timeout: 15000 });
        await expect(version2Card).toContainText('3 questions');
        await expect(version2Card).toContainText('3 answers snapshotted');

        const version1Card = page.locator('.border-slate-200, .card').filter({ hasText: 'Questionnaire Definition Version 1' }).first();
        await expect(version1Card).toBeVisible({ timeout: 15000 });
        await expect(version1Card).toContainText('2 questions');
        await expect(version1Card).toContainText('2 answers snapshotted');

        // Step 4: Open V1 Historical Details Dialog via 'View Snapshot' button
        const v1ViewSnapshotButton = version1Card.getByRole('button', { name: /View Snapshot/i }).first();
        await expect(v1ViewSnapshotButton).toBeVisible({ timeout: 10000 });
        await v1ViewSnapshotButton.click();

        const dialog = page.getByRole('dialog').first();
        await expect(dialog).toBeVisible({ timeout: 10000 });
        await expect(dialog).toContainText('Definition Version 1');

        // Assert V1 frozen question text, mapping, and answers
        await expect(dialog).toContainText('V1 Question 1 - Entity Legal Name');
        await expect(dialog).toContainText('Acme Apex Alpha Corp');
        await expect(dialog).toContainText('V1 Question 2 - Legal Entity Identifier (LEI)');
        await expect(dialog).toContainText('5493006MHB84DD0ZWV18');

        // Close V1 Dialog
        const closeButton = dialog.locator('button:has(svg.lucide-x), button:has-text("Close")').first();
        if (await closeButton.isVisible()) {
            await closeButton.click();
        } else {
            await page.keyboard.press('Escape');
        }
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        // Step 5: Open V2 Historical Details Dialog via 'View Snapshot' button
        const v2ViewSnapshotButton = version2Card.getByRole('button', { name: /View Snapshot/i }).first();
        await expect(v2ViewSnapshotButton).toBeVisible({ timeout: 10000 });
        await v2ViewSnapshotButton.click();

        const dialog2 = page.getByRole('dialog').first();
        await expect(dialog2).toBeVisible({ timeout: 10000 });
        await expect(dialog2).toContainText('Definition Version 2');

        // Assert V2 updated question text, mapping, and answers
        await expect(dialog2).toContainText('V1 Question 1 - Entity Legal Name');
        await expect(dialog2).toContainText('Acme Apex Alpha Corp');
        await expect(dialog2).toContainText('V2 Question 2 - Companies House Registration Number');
        await expect(dialog2).toContainText('09876543');
        await expect(dialog2).toContainText('V2 Question 3 - Primary Contact Note');
        await expect(dialog2).toContainText('Direct contact note for V2');

        // Close V2 Dialog
        const closeButton2 = dialog2.locator('button:has(svg.lucide-x), button:has-text("Close")').first();
        if (await closeButton2.isVisible()) {
            await closeButton2.click();
        } else {
            await page.keyboard.press('Escape');
        }
        await expect(dialog2).not.toBeVisible({ timeout: 5000 });

        // Step 6: Reload page and confirm version separation remains in fresh context
        await page.reload();
        await page.waitForLoadState('networkidle');

        const reloadedHistoryTab = page.getByRole('button', { name: /Approval History/i });
        await expect(reloadedHistoryTab).toBeVisible({ timeout: 15000 });
        await reloadedHistoryTab.click();

        await expect(page.locator('.border-slate-200, .card').filter({ hasText: 'Questionnaire Definition Version 2' }).first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.border-slate-200, .card').filter({ hasText: 'Questionnaire Definition Version 1' }).first()).toBeVisible({ timeout: 10000 });
    });
});
