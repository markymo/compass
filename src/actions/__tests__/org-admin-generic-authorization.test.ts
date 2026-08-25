import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { createLegalEntity } from '../client-le';
import { getClientLEData } from '../client';
import { getSupplierTeamMembers, getFIEngagementById } from '../fi';
import { cloneQuestionnaire } from '../questionnaire';
import { inviteUser } from '../invitations';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        organization: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        clientLE: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn(),
            update: vi.fn()
        },
        clientLEOwner: {
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        fIEngagement: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        membership: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn(),
            delete: vi.fn()
        },
        invitation: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn()
        },
        questionnaire: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
        },
        question: {
            createMany: vi.fn()
        },
        usageLog: {
            create: vi.fn()
        }
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
    getCurrentUser: vi.fn()
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/actions/admin', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/actions/logging', () => ({
    logActivity: vi.fn().mockResolvedValue(undefined)
}));

const prismaMock = prisma as any;

describe('Generic ORG_ADMIN Authorization Integration Suite', () => {
    const CLIENT_ORG_ID = 'org-client-100';
    const SUPPLIER_ORG_ID = 'org-supplier-200';
    const UNRELATED_ORG_ID = 'org-unrelated-300';
    const CLIENT_LE_ID = 'le-alpha-1';
    const ENGAGEMENT_ID = 'eng-beta-1';

    const USER_CLIENT_ADMIN = 'user-client-admin';
    const USER_SUPPLIER_ADMIN = 'user-supplier-admin';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock organization lookups
        prismaMock.organization.findUnique.mockImplementation((args: any) => {
            if (args.where?.id === CLIENT_ORG_ID) {
                return Promise.resolve({ id: CLIENT_ORG_ID, name: 'Client Corp', types: ['CLIENT'] });
            }
            if (args.where?.id === SUPPLIER_ORG_ID) {
                return Promise.resolve({ id: SUPPLIER_ORG_ID, name: 'Supplier Inc', types: ['SUPPLIER', 'FI'] });
            }
            if (args.where?.id === UNRELATED_ORG_ID) {
                return Promise.resolve({ id: UNRELATED_ORG_ID, name: 'Other Org', types: ['CLIENT'] });
            }
            return Promise.resolve(null);
        });

        // Default mock clientLEOwner lookup
        prismaMock.clientLEOwner.findMany.mockImplementation((args: any) => {
            if (args.where?.clientLEId === CLIENT_LE_ID) {
                return Promise.resolve([{
                    partyId: CLIENT_ORG_ID,
                    clientLE: { isDeleted: false },
                    party: { types: ['CLIENT'] }
                }]);
            }
            return Promise.resolve([]);
        });

        // Default mock clientLE lookup
        prismaMock.clientLE.findUnique.mockResolvedValue({
            id: CLIENT_LE_ID,
            name: 'Alpha Ltd',
            isDeleted: false,
            owners: [{ partyId: CLIENT_ORG_ID, party: { types: ['CLIENT'] } }],
            fiEngagements: []
        });

        // Default mock engagement lookup
        prismaMock.fIEngagement.findUnique.mockResolvedValue({
            id: ENGAGEMENT_ID,
            clientLEId: CLIENT_LE_ID,
            orgId: SUPPLIER_ORG_ID,
            isDeleted: false
        });
        prismaMock.fIEngagement.findFirst.mockResolvedValue({
            id: ENGAGEMENT_ID,
            clientLEId: CLIENT_LE_ID,
            orgId: SUPPLIER_ORG_ID,
            isDeleted: false,
            clientLE: { name: 'Alpha Ltd', owners: [] },
            org: { name: 'Supplier Inc' },
            questionnaireInstances: []
        });

        prismaMock.user.findUnique.mockResolvedValue(null);
    });

    describe('1. ClientLE Creation & Provisioning', () => {
        it('allows Client ORG_ADMIN to create a ClientLE under a CLIENT organization', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_CLIENT_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['CLIENT'] }
                }
            ]);
            prismaMock.clientLE.create.mockResolvedValue({
                id: 'le-new-1',
                name: 'New Sub Ltd',
                status: 'ACTIVE'
            });

            const result = await createLegalEntity({
                name: 'New Sub Ltd',
                jurisdiction: 'GB',
                clientOrgId: CLIENT_ORG_ID
            });

            expect(result.success).toBe(true);
            expect(prismaMock.clientLE.create).toHaveBeenCalled();
        });

        it('denies Supplier-only ORG_ADMIN from creating a ClientLE', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_SUPPLIER_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['SUPPLIER', 'FI'] }
                }
            ]);

            const result = await createLegalEntity({
                name: 'Unauthorized LE',
                jurisdiction: 'GB',
                clientOrgId: SUPPLIER_ORG_ID
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Unauthorized');
            expect(prismaMock.clientLE.create).not.toHaveBeenCalled();
        });
    });

    describe('2. Questionnaire & Template Library Administration', () => {
        it('allows Supplier ORG_ADMIN to clone/administer reusable questionnaire templates in their library', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_SUPPLIER_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['SUPPLIER', 'FI'] }
                }
            ]);
            prismaMock.questionnaire.findUnique.mockResolvedValue({
                id: 'template-source-1',
                name: 'KYC Standard Template',
                extractedContent: { title: 'KYC' },
                mappings: {},
                questions: []
            });
            prismaMock.questionnaire.create.mockResolvedValue({
                id: 'template-clone-1',
                fiOrgId: SUPPLIER_ORG_ID,
                name: 'KYC Standard Template (Copy)',
                status: 'DRAFT'
            });

            const result = await cloneQuestionnaire('template-source-1', SUPPLIER_ORG_ID);

            expect(result.success).toBe(true);
            expect(prismaMock.questionnaire.create).toHaveBeenCalled();
        });

        it('denies Client-only ORG_ADMIN from administering Supplier questionnaire templates via ORG_ADMIN', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_CLIENT_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['CLIENT'] }
                }
            ]);

            await expect(cloneQuestionnaire('template-source-1', CLIENT_ORG_ID)).rejects.toThrow('Unauthorized');
            expect(prismaMock.questionnaire.create).not.toHaveBeenCalled();
        });
    });

    describe('3. Generic Org Admin Team Administration', () => {
        it('allows Supplier ORG_ADMIN to administer team members in a Supplier organization', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_SUPPLIER_ADMIN });
            prismaMock.membership.findMany
                // First call: check calling user membership
                .mockResolvedValueOnce([
                    { organizationId: SUPPLIER_ORG_ID, fiEngagement: null, role: 'ORG_ADMIN' }
                ])
                // Second call: list team members
                .mockResolvedValueOnce([
                    {
                        organizationId: SUPPLIER_ORG_ID,
                        role: 'ORG_ADMIN',
                        createdAt: new Date(),
                        user: { id: USER_SUPPLIER_ADMIN, name: 'Sam Admin', email: 'sam@supplier.com' },
                        fiEngagement: null
                    }
                ]);
            prismaMock.invitation.findMany.mockResolvedValueOnce([]);

            const result = await getSupplierTeamMembers(SUPPLIER_ORG_ID);

            expect(result.members).toHaveLength(1);
            expect(result.members[0].roleLabel).toBe('Supplier Admin');
        });

        it('allows Client ORG_ADMIN to invite team members (ORG_MEMBER) to a Client organization', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_CLIENT_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['CLIENT'] }
                }
            ]);
            prismaMock.invitation.findFirst.mockResolvedValue(null);
            prismaMock.invitation.create.mockResolvedValue({
                id: 'inv-123',
                sentToEmail: 'newbie@client.com',
                organizationId: CLIENT_ORG_ID,
                role: 'ORG_MEMBER'
            });

            const result = await inviteUser({
                email: 'newbie@client.com',
                role: 'ORG_MEMBER',
                organizationId: CLIENT_ORG_ID
            });

            expect(result.success).toBe(true);
            expect(prismaMock.invitation.create).toHaveBeenCalled();
        });
    });

    describe('4. Operational Isolation (Denied Without Direct Workspace Memberships)', () => {
        it('denies Client ORG_ADMIN operational Master Data access without direct LE membership', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_CLIENT_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['CLIENT'] }
                }
            ]);

            const result = await getClientLEData(CLIENT_LE_ID);

            expect(result).toBeNull();
        });

        it('denies Supplier ORG_ADMIN operational relationship data access without explicit Relationship membership', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_SUPPLIER_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['SUPPLIER', 'FI'] }
                }
            ]);

            const result = await getFIEngagementById(ENGAGEMENT_ID);

            expect(result).toBeNull();
        });
    });

    describe('5. Cross-Organisation Administration Isolation', () => {
        it('denies Org A ORG_ADMIN from creating ClientLEs under Org B', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_CLIENT_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['CLIENT'] }
                }
            ]);

            const result = await createLegalEntity({
                name: 'Cross Org LE',
                jurisdiction: 'GB',
                clientOrgId: UNRELATED_ORG_ID
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Unauthorized');
            expect(prismaMock.clientLE.create).not.toHaveBeenCalled();
        });

        it('denies Org A ORG_ADMIN from accessing team member list of Org B', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_CLIENT_ADMIN });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: { types: ['CLIENT'] }
                }
            ]);

            const result = await getSupplierTeamMembers(SUPPLIER_ORG_ID);

            expect(result.members).toEqual([]);
            expect(result.pendingInvitations).toEqual([]);
        });
    });
});
