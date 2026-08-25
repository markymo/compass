import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getQuestionnaireExportPdf } from '@/app/api/export/questionnaire/[id]/route';
import { POST as postQuestionnaireExport } from '@/app/api/export/questionnaire/route';
import { POST as postOutputPack } from '@/app/api/export/output-pack/route';
import { GET as getQuestionnaireDownload } from '@/app/api/questionnaires/[id]/download/route';
import { GET as getDebugLivePayloads } from '@/app/api/admin/debug-live-payloads/route';
import { getIdentity } from '@/lib/auth';
import { isSystemAdmin } from '@/actions/security';
import { resolveQuestionnaireContext } from '@/lib/kyc/engagement-context';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn(),
}));

vi.mock('@/lib/export/export-answer-resolver', () => ({
    resolveExportAnswer: vi.fn().mockResolvedValue({ displayValue: 'Test Answer', answerState: 'HAS_VALUE' }),
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-1'),
    },
}));

vi.mock('@/lib/kyc/engagement-context', () => ({
    resolveQuestionnaireContext: vi.fn(),
}));

vi.mock('@react-pdf/renderer', async (importOriginal) => {
    const actual: any = await importOriginal();
    const { Readable } = await import('stream');
    return {
        ...actual,
        renderToStream: vi.fn().mockImplementation(() => Promise.resolve(Readable.from([Buffer.from('PDF CONTENT')]))),
    };
});

vi.mock('@sentry/nextjs', () => ({
    startSpan: vi.fn().mockImplementation((opts, callback) => callback()),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        membership: {
            findMany: vi.fn(),
        },
        document: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        questionnaire: {
            findUnique: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
        },
        question: {
            findMany: vi.fn(),
        },
        fIEngagement: {
            findUnique: vi.fn(),
        },
        clientLE: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        clientLEOwner: {
            findMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        sourceSamplePayload: {
            findMany: vi.fn(),
        },
        sourceFieldMapping: {
            findMany: vi.fn(),
        },
    },
}));

describe('Export & Download API Routes Authorization Remediation', () => {
    const CLIENT_LE_ID = 'cle-active-1';
    const DELETED_LE_ID = 'cle-deleted-1';
    const OTHER_CLIENT_LE_ID = 'cle-other-2';
    const ENGAGEMENT_ID = 'eng-1';
    const QUESTIONNAIRE_ID = 'q-1';
    const FI_ORG_ID = 'fi-org-1';

    const CLIENT_USER_ID = 'user-client';
    const SUPPLIER_ENG_USER_ID = 'user-supplier-eng';
    const SUPPLIER_TEMPLATE_USER_ID = 'user-supplier-template';
    const UNRELATED_USER_ID = 'user-unrelated';
    const DELETED_LE_USER_ID = 'user-deleted-le';
    const SYSADMIN_USER_ID = 'user-sysadmin';

    const mockQuestionnaireCtx = {
        questionnaire: { id: QUESTIONNAIRE_ID, isDeleted: false, fiEngagementId: ENGAGEMENT_ID, title: 'Test Questionnaire' },
        engagement: { id: ENGAGEMENT_ID, clientLEId: CLIENT_LE_ID },
        clientLE: { id: CLIENT_LE_ID, name: 'Test LE', isDeleted: false },
        clientLeId: CLIENT_LE_ID,
        subjectLeId: 'le-subject-1',
        ownerScopeId: 'scope-1',
    };

    const mockEngagement = {
        id: ENGAGEMENT_ID,
        clientLEId: CLIENT_LE_ID,
        org: { name: 'Test FI Org' },
        clientLE: { id: CLIENT_LE_ID, name: 'Test LE', isDeleted: false, legalEntityId: 'le-subject-1' },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isSystemAdmin).mockResolvedValue(false);
        vi.mocked(prisma.membership.findMany).mockResolvedValue([]);
        vi.mocked(prisma.question.findMany).mockResolvedValue([]);
        vi.mocked(prisma.clientLEOwner.findMany).mockResolvedValue([]);
        vi.mocked(prisma.sourceSamplePayload.findMany).mockResolvedValue([]);
        vi.mocked(prisma.sourceFieldMapping.findMany).mockResolvedValue([]);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-id', name: 'Test User' } as any);
    });

    describe('1. GET /api/export/questionnaire/[id]', () => {
        const createReq = (id: string) => new NextRequest(`http://localhost/api/export/questionnaire/${id}`);

        it('denies unauthenticated caller (401)', async () => {
            vi.mocked(getIdentity).mockResolvedValue(null);

            const res = await getQuestionnaireExportPdf(createReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(401);
        });

        it('denies unrelated authenticated user (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: UNRELATED_USER_ID } as any);
            vi.mocked(resolveQuestionnaireContext).mockResolvedValue(mockQuestionnaireCtx);

            const res = await getQuestionnaireExportPdf(createReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(403);
        });

        it('denies user whose only membership is on a soft-deleted ClientLE (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: DELETED_LE_USER_ID } as any);
            const deletedCtx = { ...mockQuestionnaireCtx, clientLeId: DELETED_LE_ID };
            vi.mocked(resolveQuestionnaireContext).mockResolvedValue(deletedCtx);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: DELETED_LE_USER_ID,
                    clientLEId: DELETED_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: true, status: 'ACTIVE' },
                }
            ] as any);

            const res = await getQuestionnaireExportPdf(createReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(403);
        });

        it('denies user on wrong ClientLE (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: UNRELATED_USER_ID } as any);
            vi.mocked(resolveQuestionnaireContext).mockResolvedValue(mockQuestionnaireCtx);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: UNRELATED_USER_ID,
                    clientLEId: OTHER_CLIENT_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: false, status: 'ACTIVE' },
                }
            ] as any);

            const res = await getQuestionnaireExportPdf(createReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(403);
        });

        it('allows authorized Client user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: CLIENT_USER_ID } as any);
            vi.mocked(resolveQuestionnaireContext).mockResolvedValue(mockQuestionnaireCtx);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: CLIENT_USER_ID,
                    clientLEId: CLIENT_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: false, status: 'ACTIVE' },
                }
            ] as any);

            const res = await getQuestionnaireExportPdf(createReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(200);
        });

        it('allows authorized Supplier engagement user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SUPPLIER_ENG_USER_ID } as any);
            vi.mocked(resolveQuestionnaireContext).mockResolvedValue(mockQuestionnaireCtx);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: SUPPLIER_ENG_USER_ID,
                    fiEngagementId: ENGAGEMENT_ID,
                    role: 'RELATIONSHIP_USER',
                }
            ] as any);

            const res = await getQuestionnaireExportPdf(createReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(200);
        });

        it('allows System Admin user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYSADMIN_USER_ID } as any);
            vi.mocked(isSystemAdmin).mockResolvedValue(true);
            vi.mocked(resolveQuestionnaireContext).mockResolvedValue(mockQuestionnaireCtx);

            const res = await getQuestionnaireExportPdf(createReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(200);
        });
    });

    describe('2. POST /api/export/questionnaire', () => {
        const createPostReq = (body: any) => new NextRequest('http://localhost/api/export/questionnaire', {
            method: 'POST',
            body: JSON.stringify(body),
        });

        it('denies unauthenticated caller (401)', async () => {
            vi.mocked(getIdentity).mockResolvedValue(null);

            const res = await postQuestionnaireExport(createPostReq({ engagementId: ENGAGEMENT_ID, format: 'EXCEL' }));

            expect(res.status).toBe(401);
        });

        it('denies user from another ClientLE (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: UNRELATED_USER_ID } as any);
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(mockEngagement as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: UNRELATED_USER_ID,
                    clientLEId: OTHER_CLIENT_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: false, status: 'ACTIVE' },
                }
            ] as any);

            const res = await postQuestionnaireExport(createPostReq({ engagementId: ENGAGEMENT_ID, format: 'EXCEL' }));

            expect(res.status).toBe(403);
        });

        it('denies user whose only membership is on a soft-deleted ClientLE (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: DELETED_LE_USER_ID } as any);
            const deletedEng = {
                ...mockEngagement,
                clientLEId: DELETED_LE_ID,
                clientLE: { id: DELETED_LE_ID, isDeleted: true, legalEntityId: 'le-subject-1' }
            };
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(deletedEng as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: DELETED_LE_USER_ID,
                    clientLEId: DELETED_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: true, status: 'ACTIVE' },
                }
            ] as any);

            const res = await postQuestionnaireExport(createPostReq({ engagementId: ENGAGEMENT_ID, format: 'EXCEL' }));

            expect(res.status).toBe(403);
        });

        it('allows authorized Client user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: CLIENT_USER_ID } as any);
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(mockEngagement as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: CLIENT_USER_ID,
                    clientLEId: CLIENT_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: false, status: 'ACTIVE' },
                }
            ] as any);

            const res = await postQuestionnaireExport(createPostReq({ engagementId: ENGAGEMENT_ID, format: 'EXCEL' }));

            expect(res.status).toBe(200);
        });

        it('allows authorized Supplier engagement user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SUPPLIER_ENG_USER_ID } as any);
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(mockEngagement as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: SUPPLIER_ENG_USER_ID,
                    fiEngagementId: ENGAGEMENT_ID,
                    role: 'RELATIONSHIP_USER',
                }
            ] as any);

            const res = await postQuestionnaireExport(createPostReq({ engagementId: ENGAGEMENT_ID, format: 'EXCEL' }));

            expect(res.status).toBe(200);
        });
    });

    describe('3. POST /api/export/output-pack', () => {
        const createPackReq = (body: any) => new NextRequest('http://localhost/api/export/output-pack', {
            method: 'POST',
            body: JSON.stringify(body),
        });

        it('denies unauthenticated caller (401)', async () => {
            vi.mocked(getIdentity).mockResolvedValue(null);

            const res = await postOutputPack(createPackReq({ engagementId: ENGAGEMENT_ID }));

            expect(res.status).toBe(401);
        });

        it('denies user without permission on target engagement (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: UNRELATED_USER_ID } as any);
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(mockEngagement as any);

            const res = await postOutputPack(createPackReq({ engagementId: ENGAGEMENT_ID }));

            expect(res.status).toBe(403);
        });

        it('denies user whose only membership belongs to a soft-deleted ClientLE (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: DELETED_LE_USER_ID } as any);
            const deletedEng = {
                ...mockEngagement,
                clientLEId: DELETED_LE_ID,
                clientLE: { id: DELETED_LE_ID, isDeleted: true }
            };
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(deletedEng as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: DELETED_LE_USER_ID,
                    clientLEId: DELETED_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: true, status: 'ACTIVE' },
                }
            ] as any);

            const res = await postOutputPack(createPackReq({ engagementId: ENGAGEMENT_ID }));

            expect(res.status).toBe(403);
        });

        it('allows authorized Client user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: CLIENT_USER_ID } as any);
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(mockEngagement as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: CLIENT_USER_ID,
                    clientLEId: CLIENT_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: false, status: 'ACTIVE' },
                }
            ] as any);

            const res = await postOutputPack(createPackReq({ engagementId: ENGAGEMENT_ID }));

            expect(res.status).toBe(200);
        });

        it('allows authorized Supplier engagement user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SUPPLIER_ENG_USER_ID } as any);
            vi.mocked(prisma.fIEngagement.findUnique).mockResolvedValue(mockEngagement as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: SUPPLIER_ENG_USER_ID,
                    fiEngagementId: ENGAGEMENT_ID,
                    role: 'RELATIONSHIP_USER',
                }
            ] as any);

            const res = await postOutputPack(createPackReq({ engagementId: ENGAGEMENT_ID }));

            expect(res.status).toBe(200);
        });
    });

    describe('4. GET /api/questionnaires/[id]/download', () => {
        const createDlReq = (id: string) => new NextRequest(`http://localhost/api/questionnaires/${id}/download`);

        it('denies unauthenticated caller (401)', async () => {
            vi.mocked(getIdentity).mockResolvedValue(null);

            const res = await getQuestionnaireDownload(createDlReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(401);
        });

        it('denies unauthorized user (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: UNRELATED_USER_ID } as any);
            vi.mocked(prisma.questionnaire.findUnique).mockResolvedValue({
                id: QUESTIONNAIRE_ID,
                fileContent: Buffer.from('PDF content'),
                fiEngagementId: ENGAGEMENT_ID,
                fiEngagement: { clientLEId: CLIENT_LE_ID }
            } as any);

            const res = await getQuestionnaireDownload(createDlReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(403);
        });

        it('allows authorized Client user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: CLIENT_USER_ID } as any);
            vi.mocked(prisma.questionnaire.findUnique).mockResolvedValue({
                id: QUESTIONNAIRE_ID,
                fileContent: Buffer.from('PDF content'),
                fileName: 'test.pdf',
                fileType: 'application/pdf',
                fiEngagementId: ENGAGEMENT_ID,
                fiEngagement: { clientLEId: CLIENT_LE_ID }
            } as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: CLIENT_USER_ID,
                    clientLEId: CLIENT_LE_ID,
                    role: 'LE_USER',
                    clientLE: { isDeleted: false, status: 'ACTIVE' },
                }
            ] as any);

            const res = await getQuestionnaireDownload(createDlReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(200);
        });

        it('allows authorized Supplier template user for FI Org template (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SUPPLIER_TEMPLATE_USER_ID } as any);
            vi.mocked(prisma.questionnaire.findUnique).mockResolvedValue({
                id: QUESTIONNAIRE_ID,
                fileContent: Buffer.from('Template PDF content'),
                fileName: 'template.pdf',
                fileType: 'application/pdf',
                fiOrgId: FI_ORG_ID,
            } as any);

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: SUPPLIER_TEMPLATE_USER_ID,
                    organizationId: FI_ORG_ID,
                    role: 'ORG_ADMIN',
                    organization: { types: ['FI', 'SUPPLIER'] }
                }
            ] as any);

            const res = await getQuestionnaireDownload(createDlReq(QUESTIONNAIRE_ID), { params: Promise.resolve({ id: QUESTIONNAIRE_ID }) });

            expect(res.status).toBe(200);
        });
    });

    describe('5. GET /api/admin/debug-live-payloads', () => {
        it('denies non-System-Admin user (403)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: CLIENT_USER_ID } as any);
            vi.mocked(isSystemAdmin).mockResolvedValue(false);

            const res = await getDebugLivePayloads();

            expect(res.status).toBe(403);
        });

        it('allows System Admin user (200)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYSADMIN_USER_ID } as any);
            vi.mocked(isSystemAdmin).mockResolvedValue(true);

            const res = await getDebugLivePayloads();

            expect(res.status).toBe(200);
        });
    });
});
