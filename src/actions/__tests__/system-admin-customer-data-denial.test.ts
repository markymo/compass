import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { isSystemAdmin } from '@/actions/security';
import { checkIsSystemAdmin } from '@/actions/client';
import { can, Action, Role } from '@/lib/auth/permissions';
import { canUserDownloadDocument } from '@/lib/auth/document-download-auth';
import { getClientLEData, saveClientLEData, getDashboardMetrics } from '@/actions/client';
import { getFullMasterData } from '@/actions/client-le';
import { getQuestionnaireById } from '@/actions/questionnaire';
import { getSystemStats, onboardClient, purgeClientLE } from '@/actions/super-admin';
import { getAllUsers, getAllClientLEsForAdmin, restoreClientLEFromAdmin, updateUserOrg } from '@/actions/admin';
import { assignQuestionToMasterField } from '@/actions/question-mapping';
import { getQuestionnairesV2 } from '@/actions/questionnaires-v2';
import { getPulseData } from '@/actions/pulse';
import { deleteOrganization } from '@/actions/org';
import { isPlatformQuestionnaire } from '@/lib/questionnaires/questionnaire-ownership';

vi.mock('@/lib/prisma', () => ({
    default: {
        membership: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
            count: vi.fn(),
        },
        organization: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            count: vi.fn(),
            delete: vi.fn(),
        },
        clientLE: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            delete: vi.fn(),
        },
        clientLEOwner: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            count: vi.fn(),
        },
        document: {
            findUnique: vi.fn(),
            deleteMany: vi.fn(),
        },
        question: {
            update: vi.fn(),
            findUnique: vi.fn(),
        },
        questionnaire: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            deleteMany: vi.fn(),
            updateMany: vi.fn(),
            count: vi.fn(),
        },
        fIEngagement: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            deleteMany: vi.fn(),
            updateMany: vi.fn(),
            count: vi.fn(),
        },
        fieldClaim: {
            findMany: vi.fn(),
            deleteMany: vi.fn(),
            count: vi.fn(),
        },
        privateDocumentUploadIntent: { deleteMany: vi.fn() },
        cCPartyDocument: { deleteMany: vi.fn() },
        cCParty: { deleteMany: vi.fn() },
        cCAddress: { deleteMany: vi.fn() },
        questionnaireSubmission: { deleteMany: vi.fn() },
        engagementActivity: { deleteMany: vi.fn() },
        query: { deleteMany: vi.fn() },
        invitation: { deleteMany: vi.fn(), count: vi.fn() },
        clientLEGraphEdge: { deleteMany: vi.fn() },
        clientLEGraphNode: { deleteMany: vi.fn() },
        clientLERecord: { deleteMany: vi.fn() },
        standingDataSection: { deleteMany: vi.fn() },
        masterFieldAssignment: { deleteMany: vi.fn() },
        masterFieldNote: { deleteMany: vi.fn() },
        lEActivity: { deleteMany: vi.fn(), findMany: vi.fn() },
        customFieldDefinition: { count: vi.fn() },
        fISchema: { count: vi.fn() },
        questionnaireVisibilityGrant: { count: vi.fn() },
        usageLog: { findMany: vi.fn() },
        $transaction: vi.fn(async (cb) => {
            if (typeof cb === 'function') {
                return await cb(prisma);
            }
            return cb;
        }),
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('org-client-1'),
        getCanonicalRecord: vi.fn().mockResolvedValue({}),
        getAuthoritativeValue: vi.fn().mockResolvedValue({ value: 'Test Value' }),
    }
}));

vi.mock('@/actions/schema-utils', () => ({
    getMasterSchemaFields: vi.fn().mockResolvedValue([]),
}));

const prismaMock = prisma as any;

describe('Platform-Only SYSTEM_ADMIN — Comprehensive Security & Denial Suite', () => {
    const SYS_ADMIN_ID = 'user-sysadmin-1';
    const CLIENT_USER_ID = 'user-client-1';
    const CLIENT_LE_ID = 'le-client-1';
    const OTHER_CLIENT_LE_ID = 'le-client-2';
    const ENGAGEMENT_ID = 'eng-1';
    const SYS_ORG_ID = 'org-system-1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Canonical Identity & isSystemAdmin Invariant', () => {
        it('identifies user with SYSTEM_ADMIN role as System Admin', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYS_ADMIN_ID, email: 'admin@coparity.com' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({
                id: 'mem-1',
                userId: SYS_ADMIN_ID,
                role: 'SYSTEM_ADMIN',
                organizationId: SYS_ORG_ID
            });

            expect(await isSystemAdmin()).toBe(true);
            expect(await checkIsSystemAdmin(SYS_ADMIN_ID)).toBe(true);
        });

        it('DENIES System Admin status to a user with ORG_MEMBER in SYSTEM org', async () => {
            const memberId = 'user-member-1';
            vi.mocked(getIdentity).mockResolvedValue({ userId: memberId, email: 'member@coparity.com' } as any);
            prismaMock.membership.findFirst.mockResolvedValue(null);

            expect(await isSystemAdmin()).toBe(false);
            expect(await checkIsSystemAdmin(memberId)).toBe(false);
        });

        it('DENIES System Admin status to a client ORG_ADMIN', async () => {
            const clientAdminId = 'user-client-admin';
            vi.mocked(getIdentity).mockResolvedValue({ userId: clientAdminId, email: 'admin@client.com' } as any);
            prismaMock.membership.findFirst.mockResolvedValue(null);

            expect(await isSystemAdmin()).toBe(false);
            expect(await checkIsSystemAdmin(clientAdminId)).toBe(false);
        });
    });

    describe('2. Customer Operational Data Denial for Pure SYSTEM_ADMIN', () => {
        beforeEach(() => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYS_ADMIN_ID, email: 'admin@coparity.com' } as any);
            // Pure SysAdmin has only SYSTEM_ADMIN role in system org
            prismaMock.membership.findFirst.mockImplementation((args: any) => {
                if (args?.where?.role === 'SYSTEM_ADMIN' || args?.where?.userId === SYS_ADMIN_ID) {
                    return Promise.resolve({
                        id: 'mem-sys',
                        userId: SYS_ADMIN_ID,
                        role: 'SYSTEM_ADMIN',
                        organizationId: SYS_ORG_ID,
                        organization: { types: ['SYSTEM'] }
                    });
                }
                return Promise.resolve(null);
            });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SYS_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'SYSTEM_ADMIN',
                    clientLE: null
                }
            ]);
            prismaMock.clientLE.findUnique.mockResolvedValue({
                id: CLIENT_LE_ID,
                name: 'Client Alpha Ltd',
                isDeleted: false,
                status: 'ACTIVE',
                legalEntityId: 'legal-1',
                owners: [{ partyId: 'org-client-1' }]
            });
            prismaMock.clientLE.findFirst.mockResolvedValue({
                id: CLIENT_LE_ID,
                name: 'Client Alpha Ltd',
                isDeleted: false,
                status: 'ACTIVE',
                legalEntityId: 'legal-1'
            });
            prismaMock.clientLEOwner.findMany.mockResolvedValue([
                { partyId: 'org-client-1', clientLE: { isDeleted: false }, party: { types: ['CLIENT'] } }
            ]);
        });

        it('strictly DENIES pure System Admin from getClientLEData()', async () => {
            const result = await getClientLEData(CLIENT_LE_ID);
            expect(result).toBeNull();
        });

        it('strictly DENIES pure System Admin from saveClientLEData()', async () => {
            const res = await saveClientLEData(CLIENT_LE_ID, 'schema-1', {});
            expect(res).toEqual({ success: false, error: 'Unauthorized: Access denied.' });
        });

        it('strictly DENIES pure System Admin from getDashboardMetrics()', async () => {
            const res = await getDashboardMetrics(CLIENT_LE_ID);
            expect(res).toBeNull();
        });

        it('strictly DENIES pure System Admin from getFullMasterData()', async () => {
            const res = await getFullMasterData(CLIENT_LE_ID);
            expect(res.success).toBe(false);
            expect(res.data).toEqual({});
        });

        it('strictly DENIES pure System Admin from downloading private customer documents', async () => {
            prismaMock.document.findUnique.mockResolvedValue({
                id: 'doc-private-1',
                clientLEId: CLIENT_LE_ID,
                isDeleted: false,
                question: null,
                prefilledForQuestion: null,
            });

            const result = await canUserDownloadDocument(SYS_ADMIN_ID, 'doc-private-1');
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(403);
        });

        it('strictly DENIES pure System Admin from inspecting live customer engagement questionnaires', async () => {
            prismaMock.questionnaire.findUnique.mockResolvedValue({
                id: 'q-live-1',
                fiEngagementId: ENGAGEMENT_ID,
                fiOrgId: 'fi-org-1',
                status: 'PUBLISHED',
                questions: [],
                fiOrg: { types: ['SUPPLIER', 'FI'] },
                ownerOrg: null,
            });

            const result = await getQuestionnaireById('q-live-1');
            expect(result).toBeNull();
        });

        it('strictly DENIES pure System Admin from tenant-owned reusable questionnaires (fiEngagementId = null, owned by Supplier Org A)', async () => {
            const SUPPLIER_ORG_A_ID = 'org-supplier-a';
            prismaMock.questionnaire.findUnique.mockResolvedValue({
                id: 'q-supplier-template-1',
                fiEngagementId: null, // Unattached template
                fiOrgId: SUPPLIER_ORG_A_ID,
                ownerOrgId: SUPPLIER_ORG_A_ID,
                name: 'Supplier A Proprietary DDQ',
                status: 'ACTIVE',
                questions: [],
                fiOrg: { types: ['SUPPLIER', 'FI'] },
                ownerOrg: { types: ['SUPPLIER', 'FI'] },
            });
            prismaMock.organization.findFirst.mockResolvedValue(null); // Not a system org

            // Pure System Admin has NO membership in Supplier Org A
            const result = await getQuestionnaireById('q-supplier-template-1');
            expect(result).toBeNull();
        });

        it('allows Supplier Org A ORG_ADMIN to inspect and manage their tenant-owned questionnaire', async () => {
            const SUPPLIER_ORG_A_ID = 'org-supplier-a';
            const SUPPLIER_USER_ID = 'user-supplier-admin';

            vi.mocked(getIdentity).mockResolvedValue({ userId: SUPPLIER_USER_ID, email: 'admin@supplier-a.com' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({
                id: 'mem-sup',
                userId: SUPPLIER_USER_ID,
                role: 'ORG_ADMIN',
                organizationId: SUPPLIER_ORG_A_ID,
                organization: { types: ['SUPPLIER', 'FI'] }
            });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_A_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    clientLE: null,
                    organization: { types: ['SUPPLIER', 'FI'] }
                }
            ]);

            prismaMock.questionnaire.findUnique.mockResolvedValue({
                id: 'q-supplier-template-1',
                fiEngagementId: null,
                fiOrgId: SUPPLIER_ORG_A_ID,
                ownerOrgId: SUPPLIER_ORG_A_ID,
                name: 'Supplier A Proprietary DDQ',
                status: 'ACTIVE',
                questions: [],
                fiOrg: { types: ['SUPPLIER', 'FI'] },
                ownerOrg: { types: ['SUPPLIER', 'FI'] },
            });

            const result = await getQuestionnaireById('q-supplier-template-1');
            expect(result).not.toBeNull();
            expect(result?.name).toBe('Supplier A Proprietary DDQ');
        });

        it('allows dual-role (System Admin + Supplier Org A role) to access Supplier A questionnaire via their Supplier role', async () => {
            const SUPPLIER_ORG_A_ID = 'org-supplier-a';
            const DUAL_USER_ID = 'user-dual-sys-supp';

            vi.mocked(getIdentity).mockResolvedValue({ userId: DUAL_USER_ID, email: 'admin@coparity.com' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SYS_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'SYSTEM_ADMIN',
                    clientLE: null,
                    organization: { types: ['SYSTEM'] }
                },
                {
                    organizationId: SUPPLIER_ORG_A_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    clientLE: null,
                    organization: { types: ['SUPPLIER', 'FI'] }
                }
            ]);

            prismaMock.questionnaire.findUnique.mockResolvedValue({
                id: 'q-supplier-template-1',
                fiEngagementId: null,
                fiOrgId: SUPPLIER_ORG_A_ID,
                ownerOrgId: SUPPLIER_ORG_A_ID,
                name: 'Supplier A Proprietary DDQ',
                status: 'ACTIVE',
                questions: [],
                fiOrg: { types: ['SUPPLIER', 'FI'] },
                ownerOrg: { types: ['SUPPLIER', 'FI'] },
            });

            const result = await getQuestionnaireById('q-supplier-template-1');
            expect(result).not.toBeNull();
            expect(result?.name).toBe('Supplier A Proprietary DDQ');
        });
    });

    describe('3. Platform Administration Actions for SYSTEM_ADMIN', () => {
        beforeEach(() => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYS_ADMIN_ID, email: 'admin@coparity.com' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({
                id: 'mem-sys',
                userId: SYS_ADMIN_ID,
                role: 'SYSTEM_ADMIN',
                organizationId: SYS_ORG_ID,
                organization: { types: ['SYSTEM'] }
            });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SYS_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'SYSTEM_ADMIN',
                    clientLE: null
                }
            ]);
            prismaMock.fIEngagement.findMany.mockResolvedValue([]);
            prismaMock.fIEngagement.updateMany.mockResolvedValue({ count: 0 });
            prismaMock.questionnaire.updateMany.mockResolvedValue({ count: 0 });
            prismaMock.lEActivity.findMany.mockResolvedValue([]);
        });

        it('allows System Admin to retrieve system statistics', async () => {
            prismaMock.organization.count.mockResolvedValue(5);
            prismaMock.clientLE.count.mockResolvedValue(10);
            prismaMock.user.count.mockResolvedValue(25);

            const stats = await getSystemStats();
            expect(stats).toEqual({
                clientCount: 5,
                leCount: 10,
                userCount: 25,
                fiCount: 5,
                lawFirmCount: 5,
            });
        });

        it('allows System Admin to onboard a new client organization', async () => {
            prismaMock.organization.create.mockResolvedValue({ id: 'org-new-1', name: 'New Client Inc' });
            prismaMock.user.findFirst.mockResolvedValue({ id: 'user-new-admin', email: 'admin@newclient.com' });
            prismaMock.membership.create.mockResolvedValue({ id: 'mem-new' });

            const res = await onboardClient({ name: 'New Client Inc', adminEmail: 'admin@newclient.com' });
            expect(res).toEqual({ success: true, orgId: 'org-new-1' });
        });

        it('allows System Admin to list all platform users and memberships', async () => {
            prismaMock.user.findMany.mockResolvedValue([
                {
                    id: 'user-1',
                    email: 'alice@example.com',
                    memberships: [
                        { organization: { id: 'org-1', name: 'Client Corp', types: ['CLIENT'] }, role: 'ORG_ADMIN' }
                    ]
                }
            ]);

            const users = await getAllUsers();
            expect(users).toHaveLength(1);
            expect(users[0].email).toBe('alice@example.com');
        });

        it('allows System Admin to list all ClientLEs directory metadata', async () => {
            prismaMock.clientLE.findMany.mockResolvedValue([
                {
                    id: CLIENT_LE_ID,
                    name: 'Alpha Ltd',
                    shortCode: 'ALPH',
                    jurisdiction: 'GB',
                    status: 'ACTIVE',
                    isDeleted: false,
                    legalEntity: { lei: '12345678901234567890' },
                    owners: [{ party: { id: 'org-1', name: 'Org 1', shortCode: 'ORG1' } }],
                    fiEngagements: [],
                    memberships: [{ id: 'mem-1' }],
                }
            ]);

            const list = await getAllClientLEsForAdmin();
            expect(list).toHaveLength(1);
            expect(list[0].name).toBe('Alpha Ltd');
            expect(list[0].lei).toBe('12345678901234567890');
        });

        it('allows System Admin to retrieve pulse telemetry logs', async () => {
            prismaMock.usageLog.findMany.mockResolvedValue([
                { userId: 'user-1', action: 'LOGIN', path: '/app', env: 'production', createdAt: new Date() }
            ]);
            prismaMock.user.findMany.mockResolvedValue([
                { id: 'user-1', name: 'User One', email: 'one@example.com', memberships: [] }
            ]);
            prismaMock.clientLE.findMany.mockResolvedValue([]);
            prismaMock.lEActivity.findMany.mockResolvedValue([]);

            const pulse = await getPulseData({ includeAllEnvs: true });
            expect(pulse.success).toBe(true);
            expect(pulse.data.userActivity).toBeDefined();
        });

        it('allows System Admin to inspect and manage platform template questionnaires', async () => {
            prismaMock.questionnaire.findUnique.mockResolvedValue({
                id: 'q-template-1',
                fiEngagementId: null, // Platform template
                fiOrgId: SYS_ORG_ID,
                ownerOrgId: SYS_ORG_ID,
                name: 'Global Standard DDQ',
                status: 'DRAFT',
                questions: [],
                fiOrg: { types: ['SYSTEM'] },
                ownerOrg: { types: ['SYSTEM'] },
            });

            const template = await getQuestionnaireById('q-template-1');
            expect(template).not.toBeNull();
            expect(template?.name).toBe('Global Standard DDQ');
        });

        it('allows System Admin to restore a soft-deleted ClientLE dossier', async () => {
            prismaMock.clientLE.findUnique.mockResolvedValue({
                id: CLIENT_LE_ID,
                isDeleted: true,
                status: 'DELETED',
                legalEntityId: 'le-1',
                legalEntity: { name: 'Alpha Ltd' },
                owners: [{ partyId: 'org-1', party: { name: 'Client Corp' } }]
            });
            prismaMock.clientLE.findFirst.mockResolvedValue(null); // No active conflicting dossier
            prismaMock.clientLE.update.mockResolvedValue({ id: CLIENT_LE_ID, isDeleted: false, status: 'ACTIVE' });
            prismaMock.fIEngagement.findMany.mockResolvedValue([]);
            prismaMock.fIEngagement.updateMany.mockResolvedValue({ count: 0 });
            prismaMock.questionnaire.updateMany.mockResolvedValue({ count: 0 });

            const res = await restoreClientLEFromAdmin(CLIENT_LE_ID);
            expect(res).toEqual({ success: true });
        });

        it('allows System Admin to purge/hard-delete a ClientLE', async () => {
            prismaMock.clientLE.findUnique.mockResolvedValue({
                id: CLIENT_LE_ID,
                name: 'Test Dossier',
                legalEntityId: 'le-1',
                owners: [{ partyId: 'org-1' }]
            });
            prismaMock.fIEngagement.findMany.mockResolvedValue([]);

            const res = await purgeClientLE(CLIENT_LE_ID);
            expect(res).toEqual({ success: true });
        });

        it('allows System Admin to hard-delete an empty organization', async () => {
            prismaMock.organization.findUnique.mockResolvedValue({ id: 'empty-org-1', name: 'Empty Org' });
            // All relation counts 0
            prismaMock.membership.count.mockResolvedValue(0);
            prismaMock.clientLEOwner.count.mockResolvedValue(0);
            prismaMock.fIEngagement.count.mockResolvedValue(0);
            prismaMock.questionnaire.count.mockResolvedValue(0);
            prismaMock.customFieldDefinition.count.mockResolvedValue(0);
            prismaMock.fISchema.count.mockResolvedValue(0);
            prismaMock.invitation.count.mockResolvedValue(0);
            prismaMock.fieldClaim.count.mockResolvedValue(0);
            prismaMock.questionnaireVisibilityGrant.count.mockResolvedValue(0);

            const res = await deleteOrganization('empty-org-1');
            expect(res).toEqual({ success: true });
        });

        it('allows System Admin to manage mapping workbench schema definitions (SYSTEM_MANAGE_PLATFORM)', async () => {
            prismaMock.question.findUnique.mockResolvedValue({ id: 'q-1', questionnaireId: 'q-ref-1', questionnaire: { kind: 'WORKING_COPY' } });
            prismaMock.question.update.mockResolvedValue({ id: 'q-1', masterFieldNo: 101 });

            const res = await assignQuestionToMasterField('q-1', 101);
            expect(res).toEqual({ success: true });
        });

        it('allows System Admin to retrieve reference library questionnaires (SYSTEM_MANAGE_PLATFORM)', async () => {
            prismaMock.questionnaire.findMany.mockResolvedValue([
                {
                    id: 'q-ref-1',
                    name: 'Ref Questionnaire',
                    status: 'PUBLISHED',
                    kind: 'REFERENCE_SNAPSHOT',
                    isGlobal: true,
                    isTemplate: true,
                    visibility: 'GLOBAL',
                    updatedAt: new Date(),
                    questions: [],
                    ownerOrg: { types: ['SYSTEM'] },
                    _count: { questions: 0, derivedVersions: 0 },
                }
            ]);

            const res = await getQuestionnairesV2();
            expect(res.referenceLibrary).toHaveLength(1);
            expect(res.referenceLibrary[0].name).toBe('Ref Questionnaire');
        });

        it('allows System Admin to manage tenant user organizations (SYSTEM_MANAGE_TENANTS)', async () => {
            prismaMock.membership.findFirst.mockResolvedValue(null);
            prismaMock.membership.create.mockResolvedValue({ id: 'mem-new', userId: 'user-2', organizationId: 'org-2', role: 'ORG_ADMIN' });

            const res = await updateUserOrg('user-2', 'org-2');
            expect(res).toEqual({ success: true });
        });
    });

    describe('4. Dual-Role Behavior & Strict Boundary Isolation', () => {
        it('allows System Admin who is ALSO an LE_ADMIN on ClientLE A to access A, while denying B', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYS_ADMIN_ID, email: 'admin@coparity.com' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({
                id: 'mem-sys',
                userId: SYS_ADMIN_ID,
                role: 'SYSTEM_ADMIN',
                organizationId: SYS_ORG_ID
            });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SYS_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'SYSTEM_ADMIN',
                    clientLE: null
                },
                {
                    organizationId: null,
                    clientLEId: CLIENT_LE_ID,
                    fiEngagementId: null,
                    role: 'LE_ADMIN',
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);

            const userWithMem = {
                id: SYS_ADMIN_ID,
                memberships: [
                    { role: 'SYSTEM_ADMIN', organizationId: SYS_ORG_ID },
                    { role: 'LE_ADMIN', clientLEId: CLIENT_LE_ID }
                ]
            };

            // Allowed on LE A via explicit LE_ADMIN role
            expect(await can(userWithMem as any, Action.LE_VIEW_MASTER_DATA, { clientLEId: CLIENT_LE_ID }, prismaMock)).toBe(true);
            expect(await can(userWithMem as any, Action.LE_EDIT_MASTER_DATA, { clientLEId: CLIENT_LE_ID }, prismaMock)).toBe(true);

            // Denied on LE B (no operational amplification)
            expect(await can(userWithMem as any, Action.LE_VIEW_MASTER_DATA, { clientLEId: OTHER_CLIENT_LE_ID }, prismaMock)).toBe(false);
            expect(await can(userWithMem as any, Action.LE_EDIT_MASTER_DATA, { clientLEId: OTHER_CLIENT_LE_ID }, prismaMock)).toBe(false);

            // Retains platform administration
            expect(await can(userWithMem as any, Action.SYSTEM_MANAGE_PLATFORM, {}, prismaMock)).toBe(true);
        });

        it('allows System Admin who is ALSO RELATIONSHIP_ADMIN on Engagement 1 to access 1, while denying 2', async () => {
            const userWithMem = {
                id: SYS_ADMIN_ID,
                memberships: [
                    { role: 'SYSTEM_ADMIN', organizationId: SYS_ORG_ID },
                    { role: 'RELATIONSHIP_ADMIN', fiEngagementId: 'eng-1' }
                ]
            };

            // Allowed on Engagement 1 via explicit RELATIONSHIP_ADMIN role
            expect(await can(userWithMem as any, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-1' }, prismaMock)).toBe(true);
            expect(await can(userWithMem as any, Action.ENG_EDIT_DRAFT_RESPONSES, { engagementId: 'eng-1' }, prismaMock)).toBe(true);

            // Denied on Engagement 2
            expect(await can(userWithMem as any, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-2' }, prismaMock)).toBe(false);
            expect(await can(userWithMem as any, Action.ENG_EDIT_DRAFT_RESPONSES, { engagementId: 'eng-2' }, prismaMock)).toBe(false);
        });
    });

    describe('5. Platform Operation Denial for Non-System-Admin Users', () => {
        beforeEach(() => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: CLIENT_USER_ID, email: 'client@example.com' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: 'client-org',
                    clientLEId: CLIENT_LE_ID,
                    fiEngagementId: null,
                    role: 'LE_USER',
                    clientLE: { isDeleted: false, status: 'ACTIVE' },
                    organization: { types: ['CLIENT'] }
                }
            ]);
        });

        it('denies non-System-Admin user from SYSTEM_MANAGE_PLATFORM operations', async () => {
            const mapRes = await assignQuestionToMasterField('q-1', 101);
            expect(mapRes).toEqual({ success: false, error: 'Unauthorized' });

            const q2Res = await getQuestionnairesV2();
            expect(q2Res).toEqual({ workingCopies: [], referenceLibrary: [], other: [] });
        });

        it('denies non-System-Admin user from SYSTEM_MANAGE_TENANTS operations', async () => {
            const onboardRes = await onboardClient({ name: 'New Client', adminEmail: 'admin@new.com' });
            expect(onboardRes).toEqual({ success: false, error: 'Unauthorized' });

            const updateOrgRes = await updateUserOrg('target-user', 'target-org');
            expect(updateOrgRes).toEqual({ success: false, error: 'Unauthorized' });

            const users = await getAllUsers();
            expect(users).toEqual([]);
        });

        it('denies non-System-Admin user from SYSTEM_VIEW_TELEMETRY operations', async () => {
            const stats = await getSystemStats();
            expect(stats).toBeNull();

            const pulse = await getPulseData();
            expect(pulse).toEqual({ success: false, error: 'System admin access required' });

            const adminLEs = await getAllClientLEsForAdmin();
            expect(adminLEs).toEqual([]);
        });

        it('denies non-System-Admin user from SYSTEM_RESTORE operations', async () => {
            const restoreRes = await restoreClientLEFromAdmin(CLIENT_LE_ID);
            expect(restoreRes.success).toBe(false);
            expect(restoreRes.error).toContain('Unauthorized');
        });

        it('denies non-System-Admin user from SYSTEM_HARD_DELETE operations', async () => {
            const purgeRes = await purgeClientLE(CLIENT_LE_ID);
            expect(purgeRes).toEqual({ success: false, error: 'Unauthorized' });
        });
    });

    describe('6. Strictly Positive Platform Questionnaire Ownership Invariant', () => {
        it('isPlatformQuestionnaire: returns false when fiEngagementId is present (live customer engagement)', async () => {
            const isPlatform = await isPlatformQuestionnaire({
                id: 'q-live',
                fiEngagementId: 'eng-123',
                fiOrg: { types: ['SYSTEM'] },
                ownerOrg: { types: ['SYSTEM'] }
            }, prismaMock);
            expect(isPlatform).toBe(false);
        });

        it('isPlatformQuestionnaire: returns false for unattached questionnaire with no SYSTEM owner (ownerOrg null, fiOrg null)', async () => {
            const isPlatform = await isPlatformQuestionnaire({
                id: 'q-unattached-no-org',
                fiEngagementId: null,
                fiOrg: null,
                ownerOrg: null
            }, prismaMock);
            expect(isPlatform).toBe(false);
        });

        it('isPlatformQuestionnaire: returns false for unattached questionnaire owned by SUPPLIER organisation', async () => {
            const isPlatform = await isPlatformQuestionnaire({
                id: 'q-sup',
                fiEngagementId: null,
                fiOrg: { types: ['SUPPLIER', 'FI'] },
                ownerOrg: { types: ['SUPPLIER', 'FI'] }
            }, prismaMock);
            expect(isPlatform).toBe(false);
        });

        it('isPlatformQuestionnaire: returns false for unattached questionnaire owned by CLIENT organisation', async () => {
            const isPlatform = await isPlatformQuestionnaire({
                id: 'q-client',
                fiEngagementId: null,
                fiOrg: { types: ['CLIENT'] },
                ownerOrg: { types: ['CLIENT'] }
            }, prismaMock);
            expect(isPlatform).toBe(false);
        });

        it('isPlatformQuestionnaire: returns true ONLY when ownerOrg or fiOrg has types containing SYSTEM', async () => {
            const isPlatformViaOwner = await isPlatformQuestionnaire({
                id: 'q-sys-owner',
                fiEngagementId: null,
                ownerOrg: { types: ['SYSTEM'] }
            }, prismaMock);
            expect(isPlatformViaOwner).toBe(true);

            const isPlatformViaFiOrg = await isPlatformQuestionnaire({
                id: 'q-sys-fiorg',
                fiEngagementId: null,
                fiOrg: { types: ['SYSTEM'] }
            }, prismaMock);
            expect(isPlatformViaFiOrg).toBe(true);
        });

        it('end-to-end: pure SYSTEM_ADMIN is strictly DENIED on unattached questionnaire with no SYSTEM owner, but ALLOWED on SYSTEM-owned questionnaire', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYS_ADMIN_ID, email: 'admin@coparity.com' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SYS_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'SYSTEM_ADMIN',
                    clientLE: null
                }
            ]);

            prismaMock.questionnaire.findUnique.mockImplementation(async ({ where }: any) => {
                if (where.id === 'q-sup-unattached') {
                    return {
                        id: 'q-sup-unattached',
                        fiEngagementId: null,
                        fiOrgId: 'org-sup-1',
                        ownerOrgId: 'org-sup-1',
                        name: 'Supplier Standalone Questionnaire',
                        fiOrg: { types: ['SUPPLIER', 'FI'] },
                        ownerOrg: { types: ['SUPPLIER', 'FI'] }
                    };
                }
                if (where.id === 'q-sys-platform') {
                    return {
                        id: 'q-sys-platform',
                        fiEngagementId: null,
                        fiOrgId: SYS_ORG_ID,
                        ownerOrgId: SYS_ORG_ID,
                        name: 'Platform Standard Reference DDQ',
                        fiOrg: { types: ['SYSTEM'] },
                        ownerOrg: { types: ['SYSTEM'] }
                    };
                }
                return null;
            });

            // 1. Unattached questionnaire owned by Supplier (no SYSTEM owner) -> DENIED (null)
            const deniedRes = await getQuestionnaireById('q-sup-unattached');
            expect(deniedRes).toBeNull();

            // 2. Unattached questionnaire owned by System Organisation -> ALLOWED
            const allowedRes = await getQuestionnaireById('q-sys-platform');
            expect(allowedRes).not.toBeNull();
            expect(allowedRes?.name).toBe('Platform Standard Reference DDQ');
        });
    });
});
