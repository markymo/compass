import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { setMasterFieldAssignment, setMasterFieldAssignmentStatus } from '../standing-data';
import { Role } from '@/lib/auth/permissions';
import { MasterFieldAssignmentStatus } from '@prisma/client';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        masterFieldAssignment: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn()
        },
        clientLE: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        clientLEOwner: {
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        membership: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn()
        }
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn()
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

const prismaMock = prisma as any;

describe('Master Field Assignment Authorization & Integrity Tests', () => {
    const LE_A_ID = 'le-tenant-a';
    const LE_B_ID = 'le-tenant-b';
    const FIELD_NO = 10;
    const VALID_ASSIGNEE_ID = 'user-assignee-valid';
    const INVALID_ASSIGNEE_ID = 'user-assignee-invalid-other-tenant';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock for existing assignment lookup
        prismaMock.masterFieldAssignment.findUnique.mockResolvedValue(null);
        prismaMock.masterFieldAssignment.upsert.mockResolvedValue({
            id: 'mfa-1',
            clientLEId: LE_A_ID,
            fieldNo: FIELD_NO,
            assignedToUserId: VALID_ASSIGNEE_ID,
            assignedByUserId: 'actor-user-id',
            status: MasterFieldAssignmentStatus.OPEN
        });
        prismaMock.masterFieldAssignment.deleteMany.mockResolvedValue({ count: 1 });
        prismaMock.masterFieldAssignment.update.mockResolvedValue({
            id: 'mfa-1',
            clientLEId: LE_A_ID,
            fieldNo: FIELD_NO,
            status: MasterFieldAssignmentStatus.DONE
        });

        // Default clientLEOwner: empty by default
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
    });

    describe('1. Actor Authorization on Target ClientLE (setMasterFieldAssignment)', () => {
        it('rejects unauthenticated caller', async () => {
            vi.mocked(getIdentity).mockResolvedValue(null);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, VALID_ASSIGNEE_ID);

            expect(res).toEqual({ success: false, error: 'Unauthorized' });
            expect(prismaMock.masterFieldAssignment.upsert).not.toHaveBeenCalled();
        });

        it('allows LE_ADMIN on ClientLE A to assign a master field on A', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-a', email: 'admin@lea.com' });
            // Caller has LE_ADMIN on LE_A_ID
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-admin-a',
                    clientLEId: LE_A_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_ADMIN,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);
            // Assignee is a valid member on LE_A_ID
            prismaMock.membership.findFirst.mockResolvedValue({
                id: 'mem-assignee',
                userId: VALID_ASSIGNEE_ID,
                clientLEId: LE_A_ID,
                role: Role.LE_USER
            });

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, VALID_ASSIGNEE_ID, 'Please review field');

            expect(res.success).toBe(true);
            expect(prismaMock.masterFieldAssignment.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { clientLEId_fieldNo: { clientLEId: LE_A_ID, fieldNo: FIELD_NO } }
                })
            );
        });

        it('allows LE_USER on ClientLE A to assign a master field on A (collaborative working)', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-a', email: 'worker@lea.com' });
            // Caller has LE_USER on LE_A_ID
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-user-a',
                    clientLEId: LE_A_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_USER,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);
            // Assignee is a valid member on LE_A_ID
            prismaMock.membership.findFirst.mockResolvedValue({
                id: 'mem-assignee',
                userId: VALID_ASSIGNEE_ID,
                clientLEId: LE_A_ID,
                role: Role.LE_USER
            });

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, VALID_ASSIGNEE_ID);

            expect(res.success).toBe(true);
            expect(prismaMock.masterFieldAssignment.upsert).toHaveBeenCalled();
        });

        it('allows LE_USER on ClientLE A to unassign (clear) an assignment on A', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-a', email: 'worker@lea.com' });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-user-a',
                    clientLEId: LE_A_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_USER,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, null);

            expect(res.success).toBe(true);
            expect(prismaMock.masterFieldAssignment.deleteMany).toHaveBeenCalledWith({
                where: { clientLEId: LE_A_ID, fieldNo: FIELD_NO }
            });
        });

        it('DENIES LE_ADMIN from ClientLE B from modifying assignments on ClientLE A', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-b', email: 'admin@leb.com' });
            // User belongs to LE_B_ID, NOT LE_A_ID
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-admin-b',
                    clientLEId: LE_B_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_ADMIN,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, VALID_ASSIGNEE_ID);

            expect(res).toEqual({
                success: false,
                error: 'Unauthorized: You do not have permission to manage assignments for this Legal Entity.'
            });
            expect(prismaMock.masterFieldAssignment.upsert).not.toHaveBeenCalled();
            expect(prismaMock.masterFieldAssignment.deleteMany).not.toHaveBeenCalled();
        });

        it('DENIES LE_USER from ClientLE B from modifying assignments on ClientLE A', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-b', email: 'worker@leb.com' });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-user-b',
                    clientLEId: LE_B_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_USER,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, null);

            expect(res).toEqual({
                success: false,
                error: 'Unauthorized: You do not have permission to manage assignments for this Legal Entity.'
            });
            expect(prismaMock.masterFieldAssignment.deleteMany).not.toHaveBeenCalled();
        });

        it('DENIES authenticated user with no membership from modifying assignments on ClientLE A', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'stranger-user', email: 'stranger@example.com' });
            prismaMock.membership.findMany.mockResolvedValue([]);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, VALID_ASSIGNEE_ID);

            expect(res).toEqual({
                success: false,
                error: 'Unauthorized: You do not have permission to manage assignments for this Legal Entity.'
            });
            expect(prismaMock.masterFieldAssignment.upsert).not.toHaveBeenCalled();
        });

        it('DENIES ORG_MEMBER from modifying assignments on ClientLE A', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-member-user', email: 'member@client.com' });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'org-member-user',
                    organizationId: 'org-1',
                    clientLEId: null,
                    fiEngagementId: null,
                    role: Role.ORG_MEMBER,
                    clientLE: null
                }
            ]);
            prismaMock.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'org-1' }]);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, VALID_ASSIGNEE_ID);

            expect(res).toEqual({
                success: false,
                error: 'Unauthorized: You do not have permission to manage assignments for this Legal Entity.'
            });
            expect(prismaMock.masterFieldAssignment.upsert).not.toHaveBeenCalled();
        });

        it('DENIES assignment modification if target ClientLE is soft-deleted', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-a', email: 'admin@lea.com' });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-admin-a',
                    clientLEId: LE_A_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_ADMIN,
                    clientLE: { isDeleted: true, status: 'ARCHIVED' }
                }
            ]);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, VALID_ASSIGNEE_ID);

            expect(res).toEqual({
                success: false,
                error: 'Unauthorized: You do not have permission to manage assignments for this Legal Entity.'
            });
            expect(prismaMock.masterFieldAssignment.upsert).not.toHaveBeenCalled();
        });
    });

    describe('2. Assignee Eligibility Validation', () => {
        it('REJECTS assignment to an assignee who is NOT a member of target ClientLE A', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-a', email: 'admin@lea.com' });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-admin-a',
                    clientLEId: LE_A_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_ADMIN,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);

            // Assignee does NOT have a membership on LE_A_ID
            prismaMock.membership.findFirst.mockResolvedValue(null);

            const res = await setMasterFieldAssignment(LE_A_ID, FIELD_NO, INVALID_ASSIGNEE_ID);

            expect(res).toEqual({
                success: false,
                error: 'Invalid assignee: user is not a member of this Legal Entity.'
            });
            expect(prismaMock.masterFieldAssignment.upsert).not.toHaveBeenCalled();
        });
    });

    describe('3. Work Status Updates Authorization (setMasterFieldAssignmentStatus)', () => {
        it('allows authorized LE_ADMIN or LE_USER to update assignment status', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-a', email: 'worker@lea.com' });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-user-a',
                    clientLEId: LE_A_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_USER,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);
            prismaMock.masterFieldAssignment.findUnique.mockResolvedValue({
                id: 'mfa-1',
                clientLEId: LE_A_ID,
                fieldNo: FIELD_NO,
                assignedToUserId: 'other-user',
                assignedByUserId: 'creator-user',
                status: MasterFieldAssignmentStatus.OPEN
            });

            const res = await setMasterFieldAssignmentStatus(LE_A_ID, FIELD_NO, MasterFieldAssignmentStatus.DONE);

            expect(res.success).toBe(true);
            expect(prismaMock.masterFieldAssignment.update).toHaveBeenCalledWith({
                where: { clientLEId_fieldNo: { clientLEId: LE_A_ID, fieldNo: FIELD_NO } },
                data: { status: MasterFieldAssignmentStatus.DONE }
            });
        });

        it('DENIES unauthorized caller from updating assignment status even if ClientLE exists', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'attacker-from-other-org', email: 'attacker@other.com' });
            // Attacker has NO membership on LE_A_ID
            prismaMock.membership.findMany.mockResolvedValue([]);

            const res = await setMasterFieldAssignmentStatus(LE_A_ID, FIELD_NO, MasterFieldAssignmentStatus.DONE);

            expect(res).toEqual({
                success: false,
                error: 'Unauthorized: You do not have permission to update assignments for this Legal Entity.'
            });
            expect(prismaMock.masterFieldAssignment.update).not.toHaveBeenCalled();
        });

        it('returns Assignment not found when target assignment does not exist for the authorized LE', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-a', email: 'worker@lea.com' });
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    userId: 'le-user-a',
                    clientLEId: LE_A_ID,
                    organizationId: null,
                    fiEngagementId: null,
                    role: Role.LE_USER,
                    clientLE: { isDeleted: false, status: 'ACTIVE' }
                }
            ]);
            prismaMock.masterFieldAssignment.findUnique.mockResolvedValue(null);

            const res = await setMasterFieldAssignmentStatus(LE_A_ID, 999, MasterFieldAssignmentStatus.DONE);

            expect(res).toEqual({
                success: false,
                error: 'Assignment not found'
            });
            expect(prismaMock.masterFieldAssignment.update).not.toHaveBeenCalled();
        });
    });
});
