import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setMasterFieldAssignment, setMasterFieldAssignmentStatus } from '../standing-data';
import { assignQuestion } from '../kanban-actions';
import { getUserAssignments, getUserAssignmentCount } from '../kyc-query';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

vi.mock('@/actions/questionnaire', () => ({
    ensureQuestionNotReferenceSnapshot: vi.fn().mockResolvedValue(true),
    ensureNotReferenceSnapshot: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        masterFieldAssignment: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        question: {
            findUnique: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        questionActivity: {
            create: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        invitation: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        clientLEOwner: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn(),
        },
        clientLE: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        }
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-100', role: 'ADMIN' })
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

describe('Task Assignment Architecture Improvements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.membership.findMany as any).mockResolvedValue([
            {
                userId: 'user-100',
                clientLEId: 'cle-1',
                organizationId: null,
                fiEngagementId: null,
                role: 'LE_ADMIN',
                clientLE: { isDeleted: false, status: 'ACTIVE' }
            }
        ]);
        (prisma.membership.findFirst as any).mockResolvedValue({
            id: 'mem-assignee-1',
            clientLEId: 'cle-1',
            userId: 'user-200',
            role: 'LE_USER'
        });
        (prisma.clientLEOwner.findMany as any).mockResolvedValue([]);
    });

    describe('1. Master Field Assignment with Notes & Deletion', () => {
        it('should upsert MasterFieldAssignment with note and status when userId is provided', async () => {
            (prisma.masterFieldAssignment.findUnique as any).mockResolvedValue(null);
            (prisma.masterFieldAssignment.upsert as any).mockResolvedValue({
                clientLEId: 'cle-1',
                fieldNo: 5,
                assignedToUserId: 'user-200',
                assignedByUserId: 'user-100',
                note: 'Please verify this value against CH',
                status: 'OPEN',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const res = await setMasterFieldAssignment('cle-1', 5, 'user-200', 'Please verify this value against CH');

            expect(res.success).toBe(true);
            expect(prisma.masterFieldAssignment.upsert).toHaveBeenCalledWith({
                where: { clientLEId_fieldNo: { clientLEId: 'cle-1', fieldNo: 5 } },
                create: {
                    clientLEId: 'cle-1',
                    fieldNo: 5,
                    assignedToUserId: 'user-200',
                    assignedByUserId: 'user-100',
                    note: 'Please verify this value against CH',
                    status: 'OPEN',
                },
                update: {
                    assignedToUserId: 'user-200',
                    assignedByUserId: 'user-100',
                    status: 'OPEN',
                    note: 'Please verify this value against CH',
                },
            });
            expect(revalidatePath).toHaveBeenCalledWith('/app/assignments');
        });

        it('should reset status to OPEN when reassigned to a new user', async () => {
            (prisma.masterFieldAssignment.findUnique as any).mockResolvedValue({
                clientLEId: 'cle-1',
                fieldNo: 5,
                assignedToUserId: 'user-200',
                assignedByUserId: 'user-100',
                status: 'DONE',
            });
            (prisma.masterFieldAssignment.upsert as any).mockResolvedValue({
                clientLEId: 'cle-1',
                fieldNo: 5,
                assignedToUserId: 'user-300',
                assignedByUserId: 'user-100',
                status: 'OPEN',
            });

            const res = await setMasterFieldAssignment('cle-1', 5, 'user-300');

            expect(res.success).toBe(true);
            expect(prisma.masterFieldAssignment.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({
                        assignedToUserId: 'user-300',
                        status: 'OPEN',
                    })
                })
            );
        });

        it('should delete MasterFieldAssignment record when userId is null', async () => {
            (prisma.masterFieldAssignment.deleteMany as any).mockResolvedValue({ count: 1 });

            const res = await setMasterFieldAssignment('cle-1', 5, null);

            expect(res.success).toBe(true);
            expect(prisma.masterFieldAssignment.deleteMany).toHaveBeenCalledWith({
                where: { clientLEId: 'cle-1', fieldNo: 5 },
            });
            expect(revalidatePath).toHaveBeenCalledWith('/app/assignments');
        });
    });

    describe('2. Question Assignment with Notes', () => {
        it('should assign question with note and record activity details', async () => {
            (prisma.question.findUnique as any).mockResolvedValue({
                id: 'q-10',
                assignedToUserId: null,
                assignedEmail: null,
                assignmentNote: null,
                isReferenceSnapshot: false,
                questionnaire: { isReferenceSnapshot: false }
            });
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'user-300',
                name: 'Alice Manager',
                email: 'alice@example.com',
            });
            (prisma.question.update as any).mockResolvedValue({
                id: 'q-10',
                assignedToUserId: 'user-300',
                assignmentNote: 'Check bank statement page 2',
            });
            (prisma.questionActivity.create as any).mockResolvedValue({
                id: 'act-1',
                questionId: 'q-10',
                type: 'ASSIGNED',
                details: { note: 'Check bank statement page 2' },
                user: { name: 'Alice Manager' },
                createdAt: new Date(),
            });

            const res = await assignQuestion('q-10', { userId: 'user-300' }, 'Check bank statement page 2');

            expect(res.success).toBe(true);
            expect(prisma.question.update).toHaveBeenCalledWith({
                where: { id: 'q-10' },
                data: {
                    assignedToUserId: 'user-300',
                    assignedByUserId: 'user-100',
                    assignedEmail: null,
                    assignmentNote: 'Check bank statement page 2',
                },
            });
            expect(prisma.questionActivity.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        questionId: 'q-10',
                        type: 'ASSIGNED',
                        details: expect.objectContaining({
                            note: 'Check bank statement page 2',
                        }),
                    }),
                })
            );
            expect(revalidatePath).toHaveBeenCalledWith('/app/assignments');
        });
    });

    describe('3. Fetch User Assignments with Notes', () => {
        it('should return master field and question assignments with notes', async () => {
            (prisma.masterFieldAssignment.findMany as any).mockResolvedValue([
                {
                    id: 'mfa-1',
                    clientLEId: 'cle-1',
                    fieldNo: 10,
                    note: 'Review registration date',
                    createdAt: new Date('2026-08-08T10:00:00Z'),
                    assignedByUser: { name: 'Bob Admin', email: 'bob@example.com' },
                    clientLE: { legalEntity: { name: 'Acme Corp' } },
                }
            ]);

            (prisma.question.findMany as any).mockResolvedValue([
                {
                    id: 'q-20',
                    text: 'What is your UBO shareholding?',
                    status: 'SUBMITTED',
                    assignmentNote: 'Verify certificate of inc',
                    createdAt: new Date('2026-08-08T11:00:00Z'),
                    assignedByUser: { name: 'Bob Admin', email: 'bob@example.com' },
                    questionnaireId: 'qn-1',
                    questionnaire: {
                        id: 'qn-1',
                        name: 'KYC Questionnaire 2026',
                        clientLE: { legalEntity: { name: 'Acme Corp' } },
                        fiEngagement: { clientLEId: 'cle-1', id: 'eng-1' },
                    },
                }
            ]);

            const result = await getUserAssignments('user-100');

            expect(result.masterFields).toHaveLength(1);
            expect(result.masterFields[0].note).toBe('Review registration date');
            expect(result.questions).toHaveLength(1);
            expect(result.questions[0].note).toBe('Verify certificate of inc');
            expect(result.questions[0].questionnaireId).toBe('qn-1');
        });
    });

    describe('4. Work Status Toggles & Navbar Count Semantics', () => {
        it('should allow marking an OPEN assignment as DONE', async () => {
            (prisma.masterFieldAssignment.findUnique as any).mockResolvedValue({
                id: 'mfa-1',
                clientLEId: 'cle-1',
                fieldNo: 5,
                assignedToUserId: 'user-100',
                assignedByUserId: 'user-200',
                status: 'OPEN',
            });
            (prisma.masterFieldAssignment.update as any).mockResolvedValue({
                id: 'mfa-1',
                status: 'DONE',
            });

            const res = await setMasterFieldAssignmentStatus('cle-1', 5, 'DONE' as any);

            expect(res.success).toBe(true);
            expect(prisma.masterFieldAssignment.update).toHaveBeenCalledWith({
                where: { clientLEId_fieldNo: { clientLEId: 'cle-1', fieldNo: 5 } },
                data: { status: 'DONE' },
            });
        });

        it('should allow reopening a DONE assignment back to OPEN', async () => {
            (prisma.masterFieldAssignment.findUnique as any).mockResolvedValue({
                id: 'mfa-1',
                clientLEId: 'cle-1',
                fieldNo: 5,
                assignedToUserId: 'user-100',
                assignedByUserId: 'user-200',
                status: 'DONE',
            });
            (prisma.masterFieldAssignment.update as any).mockResolvedValue({
                id: 'mfa-1',
                status: 'OPEN',
            });

            const res = await setMasterFieldAssignmentStatus('cle-1', 5, 'OPEN' as any);

            expect(res.success).toBe(true);
            expect(prisma.masterFieldAssignment.update).toHaveBeenCalledWith({
                where: { clientLEId_fieldNo: { clientLEId: 'cle-1', fieldNo: 5 } },
                data: { status: 'OPEN' },
            });
        });

        it('should only include OPEN MasterFieldAssignments in navbar badge count', async () => {
            (prisma.question.count as any).mockResolvedValue(2);
            (prisma.masterFieldAssignment.count as any).mockResolvedValue(1);

            const count = await getUserAssignmentCount('user-100');

            expect(count).toBe(3);
            expect(prisma.masterFieldAssignment.count).toHaveBeenCalledWith({
                where: {
                    assignedToUserId: 'user-100',
                    status: 'OPEN',
                },
            });
        });
    });
});
