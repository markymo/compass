import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { purgeClientLE } from '../super-admin';
import { isSystemAdmin } from '../admin';

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn(), delete: vi.fn() },
        privateDocumentUploadIntent: { deleteMany: vi.fn() },
        cCPartyDocument: { deleteMany: vi.fn() },
        cCParty: { deleteMany: vi.fn() },
        cCAddress: { deleteMany: vi.fn() },
        questionnaireSubmission: { deleteMany: vi.fn() },
        fieldClaim: { deleteMany: vi.fn() },
        fIEngagement: { findMany: vi.fn(), deleteMany: vi.fn() },
        questionnaire: { deleteMany: vi.fn() },
        engagementActivity: { deleteMany: vi.fn() },
        query: { deleteMany: vi.fn() },
        document: { deleteMany: vi.fn() },
        invitation: { deleteMany: vi.fn() },
        clientLEGraphEdge: { deleteMany: vi.fn() },
        clientLEGraphNode: { deleteMany: vi.fn() },
        clientLERecord: { deleteMany: vi.fn() },
        standingDataSection: { deleteMany: vi.fn() },
        masterFieldAssignment: { deleteMany: vi.fn() },
        masterFieldNote: { deleteMany: vi.fn() },
        lEActivity: { deleteMany: vi.fn() },
        membership: { deleteMany: vi.fn() },
        $transaction: vi.fn((cb) => typeof cb === 'function' ? cb(prisma) : Promise.all(cb))
    }
}));

vi.mock('../admin', () => ({
    isSystemAdmin: vi.fn()
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

const prismaMock = prisma as any;

describe('Hard Delete — purgeClientLE', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects execution if caller is not a system admin', async () => {
        vi.mocked(isSystemAdmin).mockResolvedValue(false);

        const res = await purgeClientLE('le-123');

        expect(res).toEqual({ success: false, error: 'Unauthorized' });
        expect(prismaMock.clientLE.findUnique).not.toHaveBeenCalled();
    });

    it('executes complete 11-step transaction when caller is system admin', async () => {
        vi.mocked(isSystemAdmin).mockResolvedValue(true);
        prismaMock.clientLE.findUnique.mockResolvedValue({
            id: 'le-123',
            name: 'Triki Consulting',
            legalEntityId: 'le-legal-1',
            owners: [{ partyId: 'org-owner-1' }]
        });
        prismaMock.fIEngagement.findMany.mockResolvedValue([{ id: 'eng-1' }]);

        const res = await purgeClientLE('le-123');

        expect(res).toEqual({ success: true });
        expect(prismaMock.privateDocumentUploadIntent.deleteMany).toHaveBeenCalled();
        expect(prismaMock.cCPartyDocument.deleteMany).toHaveBeenCalled();
        expect(prismaMock.cCParty.deleteMany).toHaveBeenCalled();
        expect(prismaMock.cCAddress.deleteMany).toHaveBeenCalled();
        expect(prismaMock.questionnaireSubmission.deleteMany).toHaveBeenCalled();
        expect(prismaMock.fieldClaim.deleteMany).toHaveBeenCalled();
        expect(prismaMock.questionnaire.deleteMany).toHaveBeenCalledWith({ where: { fiEngagementId: { in: ['eng-1'] } } });
        expect(prismaMock.document.deleteMany).toHaveBeenCalledWith({ where: { clientLEId: 'le-123' } });
        expect(prismaMock.invitation.deleteMany).toHaveBeenCalled();
        expect(prismaMock.fIEngagement.deleteMany).toHaveBeenCalledWith({ where: { clientLEId: 'le-123' } });
        expect(prismaMock.clientLEGraphEdge.deleteMany).toHaveBeenCalledWith({ where: { clientLEId: 'le-123' } });
        expect(prismaMock.clientLEGraphNode.deleteMany).toHaveBeenCalledWith({ where: { clientLEId: 'le-123' } });
        expect(prismaMock.clientLE.delete).toHaveBeenCalledWith({ where: { id: 'le-123' } });
    });
});
