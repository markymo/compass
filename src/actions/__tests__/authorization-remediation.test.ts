import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { getActorContext } from '@/lib/auth/actor-context';
import { addFieldAttachment, replaceFieldAttachment, removeFieldAttachment } from '../attachment-actions';
import { submitQuestionnaireAction, getSubmissionHistoryAction, getSubmissionDetailAction, getRelationshipsForLEAction } from '../submission-actions';
import { getFIDashboardStats, getSupplierRelationshipsSummary } from '../fi';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { createQuestionnaireSubmission, getSubmissionHistoryForRelationship, getSubmissionById } from '@/services/submissionService';

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn() },
        clientLEOwner: { findMany: vi.fn() },
        fIEngagement: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn() },
        questionnaireSubmission: { findUnique: vi.fn() },
        questionnaire: { count: vi.fn() },
        query: { count: vi.fn() }
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn()
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        addAttachment: vi.fn(),
        replaceAttachment: vi.fn(),
        removeAttachment: vi.fn()
    }
}));

vi.mock('@/services/submissionService', () => ({
    createQuestionnaireSubmission: vi.fn(),
    getSubmissionHistoryForRelationship: vi.fn(),
    getSubmissionById: vi.fn()
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

const prismaMock = prisma as any;

describe('Security Remediation — Authorization Gaps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
    });

    describe('1. Attachment Mutations Authorization', () => {
        it('allows LE_ADMIN to add attachment', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { clientLEId: 'cle-1', role: 'LE_ADMIN', fiEngagementId: null }
            ]);
            prismaMock.clientLE.findUnique.mockResolvedValue({ id: 'cle-1', legalEntityId: 'le-entity-1' });
            vi.mocked(FieldClaimService.addAttachment).mockResolvedValue({ success: true } as any);

            const result = await addFieldAttachment({
                clientLEId: 'cle-1',
                fieldNo: 101,
                attachmentDocumentId: 'doc-1'
            });

            expect(result).toEqual({ success: true });
            expect(FieldClaimService.addAttachment).toHaveBeenCalled();
        });

        it('denies user from another ClientLE before persistent mutation occurs', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'other-user' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { clientLEId: 'cle-OTHER', role: 'LE_ADMIN', fiEngagementId: null }
            ]);

            await expect(
                addFieldAttachment({
                    clientLEId: 'cle-1',
                    fieldNo: 101,
                    attachmentDocumentId: 'doc-1'
                })
            ).rejects.toThrow('Unauthorized');

            expect(FieldClaimService.addAttachment).not.toHaveBeenCalled();
            expect(prismaMock.clientLE.findUnique).not.toHaveBeenCalled();
        });

        it('denies unauthorised supplier user before replacing attachment', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-user' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { role: 'RELATIONSHIP_USER', fiEngagementId: 'eng-1' }
            ]);

            await expect(
                replaceFieldAttachment({
                    clientLEId: 'cle-1',
                    fieldNo: 101,
                    instanceId: 'inst-1',
                    attachmentDocumentId: 'doc-2'
                })
            ).rejects.toThrow('Unauthorized');

            expect(FieldClaimService.replaceAttachment).not.toHaveBeenCalled();
        });

        it('denies user without LE_EDIT_MASTER_DATA from removing attachment', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'unauthorized-user' } as any);
            prismaMock.membership.findMany.mockResolvedValue([]);

            await expect(
                removeFieldAttachment({
                    clientLEId: 'cle-1',
                    fieldNo: 101,
                    instanceId: 'inst-1'
                })
            ).rejects.toThrow('Unauthorized');

            expect(FieldClaimService.removeAttachment).not.toHaveBeenCalled();
        });
    });

    describe('2. Questionnaire Submission Authorization', () => {
        it('allows RELATIONSHIP_ADMIN to submit questionnaire', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-admin-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { fiEngagementId: 'eng-1', role: 'RELATIONSHIP_ADMIN' }
            ]);
            vi.mocked(createQuestionnaireSubmission).mockResolvedValue({ success: true, submissionId: 'sub-1' } as any);

            const res = await submitQuestionnaireAction({
                questionnaireId: 'q-1',
                relationshipId: 'eng-1',
                clientLEId: 'cle-1'
            });

            expect(res).toEqual({ success: true, submissionId: 'sub-1' });
        });

        it('denies RELATIONSHIP_USER (lacks sign-off permission) from submitting questionnaire', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-user-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { fiEngagementId: 'eng-1', role: 'RELATIONSHIP_USER' }
            ]);

            const res = await submitQuestionnaireAction({
                questionnaireId: 'q-1',
                relationshipId: 'eng-1',
                clientLEId: 'cle-1'
            });

            expect(res).toEqual({ success: false, error: 'Unauthorized' });
            expect(createQuestionnaireSubmission).not.toHaveBeenCalled();
        });

        it('denies user from an unrelated relationship from submitting', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'other-user' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { fiEngagementId: 'eng-OTHER', role: 'RELATIONSHIP_ADMIN' }
            ]);

            const res = await submitQuestionnaireAction({
                questionnaireId: 'q-1',
                relationshipId: 'eng-1',
                clientLEId: 'cle-1'
            });

            expect(res).toEqual({ success: false, error: 'Unauthorized' });
            expect(createQuestionnaireSubmission).not.toHaveBeenCalled();
        });
    });

    describe('3. Submission History/Detail Authorization', () => {
        it('allows user with ENG_VIEW_RELEASED_DATA to view history', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-user-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { fiEngagementId: 'eng-1', role: 'RELATIONSHIP_USER' }
            ]);
            vi.mocked(getSubmissionHistoryForRelationship).mockResolvedValue([{ id: 'sub-1' }] as any);

            const res = await getSubmissionHistoryAction({
                questionnaireId: 'q-1',
                relationshipId: 'eng-1'
            });

            expect(res.success).toBe(true);
            expect(res.data).toHaveLength(1);
        });

        it('denies view history if relationshipId is missing or user has no access', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([]);

            const resNoRel = await getSubmissionHistoryAction({ questionnaireId: 'q-1' });
            expect(resNoRel).toEqual({ success: false, error: 'Unauthorized' });

            const resUnauthorized = await getSubmissionHistoryAction({
                questionnaireId: 'q-1',
                relationshipId: 'eng-1'
            });
            expect(resUnauthorized).toEqual({ success: false, error: 'Unauthorized' });
        });

        it('allows authorized user to view submission detail resolved server-side', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-user-1' } as any);
            prismaMock.questionnaireSubmission.findUnique.mockResolvedValue({ relationshipId: 'eng-1' });
            prismaMock.membership.findMany.mockResolvedValue([
                { fiEngagementId: 'eng-1', role: 'RELATIONSHIP_USER' }
            ]);
            vi.mocked(getSubmissionById).mockResolvedValue({ id: 'sub-1', relationshipId: 'eng-1' } as any);

            const res = await getSubmissionDetailAction('sub-1');
            expect(res.success).toBe(true);
            expect(getSubmissionById).toHaveBeenCalledWith('sub-1');
        });

        it('prevents cross-relationship access and avoids leaking existence for invalid/unauthorized submissionId', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'attacker' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { fiEngagementId: 'eng-ATTACKER', role: 'RELATIONSHIP_USER' }
            ]);

            // Case A: Submission exists on another relationship
            prismaMock.questionnaireSubmission.findUnique.mockResolvedValue({ relationshipId: 'eng-VICTIM' });
            const resCross = await getSubmissionDetailAction('sub-victim-100');
            expect(resCross).toEqual({ success: false, error: 'Unauthorized' });
            expect(getSubmissionById).not.toHaveBeenCalled();

            // Case B: Submission does not exist
            prismaMock.questionnaireSubmission.findUnique.mockResolvedValue(null);
            const resNonExistent = await getSubmissionDetailAction('sub-fake-999');
            expect(resNonExistent).toEqual({ success: false, error: 'Unauthorized' });
            expect(getSubmissionById).not.toHaveBeenCalled();

            // Verification: Both return identical response
            expect(resCross).toEqual(resNonExistent);
        });
    });

    describe('4. Relationships-for-ClientLE Authorization', () => {
        it('allows user with LE_VIEW_MASTER_DATA to query relationships for LE', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { clientLEId: 'cle-1', role: 'LE_USER', fiEngagementId: null }
            ]);
            prismaMock.fIEngagement.findMany.mockResolvedValue([
                { id: 'eng-1', org: { id: 'org-1', name: 'Bank A' }, status: 'Active' }
            ]);

            const res = await getRelationshipsForLEAction('cle-1');
            expect(res.success).toBe(true);
            expect(res.data).toHaveLength(1);
        });

        it('denies cross-ClientLE relationships query', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-other' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { clientLEId: 'cle-OTHER', role: 'LE_USER', fiEngagementId: null }
            ]);

            const res = await getRelationshipsForLEAction('cle-1');
            expect(res).toEqual({ success: false, error: 'Unauthorized' });
            expect(prismaMock.fIEngagement.findMany).not.toHaveBeenCalled();
        });
    });

    describe('5. Supplier Dashboard & Relationship Summaries', () => {
        it('allows SUPPLIER_ADMIN to get dashboard stats for their FI org', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-admin-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'fi-org-1', fiEngagementId: null }
            ]);
            prismaMock.questionnaire.count.mockResolvedValue(5);
            prismaMock.fIEngagement.count.mockResolvedValue(3);
            prismaMock.query.count.mockResolvedValue(2);

            const stats = await getFIDashboardStats('fi-org-1');
            expect(stats).toEqual({ questionnaires: 5, engagements: 3, queries: 2 });
        });

        it('denies supplier user from accessing stats of an arbitrary fiOrgId that they have no access to', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-user-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'fi-org-MINE', fiEngagementId: null }
            ]);

            const stats = await getFIDashboardStats('fi-org-OTHER');
            expect(stats).toBeNull();
        });

        it('denies supplier user from accessing relationships summary of an arbitrary fiOrgId', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-user-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'fi-org-MINE', fiEngagementId: null }
            ]);

            const summary = await getSupplierRelationshipsSummary('fi-org-OTHER');
            expect(summary).toEqual([]);
        });
    });
});
