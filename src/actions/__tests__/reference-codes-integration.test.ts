import { describe, expect, it, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { addToReferenceLibrary, createWorkingCopy } from '../questionnaires-v2';
import { assignQuestionnaireToEngagement } from '../questionnaire';
import { bootstrapSystemOrg } from '../admin';

// Mock security and auth
vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

// Mock permissions
vi.mock('@/lib/auth/permissions', () => ({
    ensureAuthorization: vi.fn().mockResolvedValue(true),
    can: vi.fn().mockReturnValue(true),
    Action: { ENG_EDIT_DRAFT_RESPONSES: 'ENG_EDIT_DRAFT_RESPONSES' },
}));

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

// We only want to test the db interactions conceptually, but since this runs against the test DB,
// we should just let it run or mock prisma. The project seems to run tests against a real DB (from test output).
// Let's create actual DB entries.

describe('Reference Codes Integration', () => {
    let sysOrgId: string;
    let templateId: string;
    let engagementId: string;

    beforeEach(async () => {
        const sysOrg = await bootstrapSystemOrg();
        sysOrgId = sysOrg.id;

        // Clean up previous test runs if needed, or just create unique data
        const uniqueSuffix = Date.now().toString();

        const le = await prisma.clientLE.create({
            data: { name: `LE-${uniqueSuffix}`, shortCode: `LE${uniqueSuffix}` }
        });

        const org = await prisma.organization.create({
            data: { name: `Supplier-${uniqueSuffix}`, shortCode: `SUP${uniqueSuffix}` }
        });

        const eng = await prisma.fIEngagement.create({
            data: {
                fiOrgId: org.id,
                clientLEId: le.id,
                status: 'PREPARATION',
            }
        });
        engagementId = eng.id;

        await prisma.user.upsert({
            where: { id: 'test-user-id' },
            create: { id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
            update: {}
        });

        await prisma.membership.create({
            data: {
                userId: 'test-user-id',
                fiEngagementId: eng.id,
                role: 'ADMIN',
            }
        });
    });

    it('addToReferenceLibrary stamps generated referenceCode on REFERENCE_SNAPSHOT', async () => {
        // Create a working copy
        const wc = await prisma.questionnaire.create({
            data: {
                name: 'Test Working Copy',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });

        const res = await addToReferenceLibrary(wc.id);
        expect(res.success).toBe(true);

        const ref = await prisma.questionnaire.findUnique({ where: { id: res.referenceId } });
        expect(ref?.kind).toBe('REFERENCE_SNAPSHOT');
        expect(ref?.functionalCode).toBe('FMSB');
        expect(ref?.referenceCode).toMatch(/^FMSB_\d{6}_COPARITY_XXXXX_SSSSS_v\d+$/);

        // Test version increment
        const wc2 = await prisma.questionnaire.create({
            data: {
                name: 'Test Working Copy 2',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'DRAFT',
                kind: 'WORKING_COPY',
                isTemplate: true,
                isGlobal: false,
            }
        });

        const res2 = await addToReferenceLibrary(wc2.id);
        expect(res2.success).toBe(true);
        const ref2 = await prisma.questionnaire.findUnique({ where: { id: res2.referenceId } });
        expect(ref2?.referenceCode).toMatch(/^FMSB_\d{6}_COPARITY_XXXXX_SSSSS_v\d+$/);
        
        templateId = ref2!.id;
    });

    it('createWorkingCopy copies referenceCode for provenance', async () => {
        const ref = await prisma.questionnaire.create({
            data: {
                name: 'Source Snapshot',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'ACTIVE',
                kind: 'REFERENCE_SNAPSHOT',
                isTemplate: true,
                isGlobal: true,
                referenceCode: 'FMSB_260605_COPARITY_XXXXX_SSSSS_v2'
            }
        });
        
        const res = await createWorkingCopy(ref.id);
        expect(res.success).toBe(true);

        const wc = await prisma.questionnaire.findUnique({ where: { id: res.workingCopyId } });
        expect(wc?.kind).toBe('WORKING_COPY');
        expect(wc?.functionalCode).toBe('FMSB');
        // It carries the source reference code
        expect(wc?.referenceCode).toMatch(/^FMSB_\d{6}_COPARITY_XXXXX_SSSSS_v\d+$/);
    });

    it('assignQuestionnaireToEngagement copies referenceCode and generates title', async () => {
        const ref = await prisma.questionnaire.create({
            data: {
                name: 'Source Snapshot',
                functionalCode: 'FMSB',
                fiOrgId: sysOrgId,
                ownerOrgId: sysOrgId,
                status: 'ACTIVE',
                kind: 'REFERENCE_SNAPSHOT',
                isTemplate: true,
                isGlobal: true,
                referenceCode: 'FMSB_260605_COPARITY_XXXXX_SSSSS_v2'
            }
        });

        const res = await assignQuestionnaireToEngagement(ref.id, engagementId);
        if (!res.success) {
            console.error("Test assignQuestionnaireToEngagement error:", res.error);
        }
        expect(res.success).toBe(true);

        const instance = await prisma.questionnaire.findUnique({ where: { id: res.id } });
        expect(instance?.kind).toBe('ENGAGEMENT_QUESTIONNAIRE');
        expect(instance?.functionalCode).toBe('FMSB');
        expect(instance?.referenceCode).toMatch(/^FMSB_\d{6}_COPARITY_XXXXX_SSSSS_v\d+$/);
        
        // The default title should reflect the LE and Supplier short codes
        expect(instance?.name).toMatch(/^FMSB_LE\d+_SUP\d+$/);
    });
});
