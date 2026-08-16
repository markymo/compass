import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActorContext } from '@/lib/auth/actor-context';
import { getRelationshipSummary } from '../relationshipService';
import prisma from '@/lib/prisma';
import { Role } from '@/lib/auth/permissions';

vi.mock('@/lib/prisma', () => ({
    default: {
        membership: {
            findMany: vi.fn(),
        },
        fIEngagement: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        clientLEOwner: {
            findMany: vi.fn(),
        },
    },
}));

describe('Secured Application Service - Relationship Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getActorContext()', () => {
        it('should construct an ActorContext with memberships and channel', async () => {
            (prisma.membership.findMany as any).mockResolvedValue([
                { organizationId: 'org-1', clientLEId: null, fiEngagementId: 'eng-1', role: Role.RELATIONSHIP_ADMIN },
            ]);

            const actor = await getActorContext('user-1', 'MCP', { clientId: 'copilot-client-123' });

            expect(actor.id).toBe('user-1');
            expect(actor.channel).toBe('MCP');
            expect(actor.clientId).toBe('copilot-client-123');
            expect(actor.memberships).toHaveLength(1);
            expect(actor.memberships[0].role).toBe(Role.RELATIONSHIP_ADMIN);
        });
    });

    describe('getRelationshipSummary()', () => {
        it('should reject unauthorized access if actor lacks relationship permissions', async () => {
            const actor = {
                id: 'user-2',
                channel: 'MCP' as const,
                memberships: [
                    { organizationId: 'org-9', clientLEId: null, fiEngagementId: 'eng-999', role: Role.RELATIONSHIP_USER },
                ],
            };

            await expect(getRelationshipSummary(actor, 'eng-100')).rejects.toThrow(
                'Unauthorized: Actor user-2 lacks access to relationship eng-100'
            );
            expect(prisma.fIEngagement.findFirst).not.toHaveBeenCalled();
        });

        it('should allow authorized actor and return transport-independent summary payload', async () => {
            const actor = {
                id: 'user-1',
                channel: 'MCP' as const,
                memberships: [
                    { organizationId: null, clientLEId: null, fiEngagementId: 'eng-100', role: Role.RELATIONSHIP_ADMIN },
                ],
            };

            (prisma.fIEngagement.findFirst as any).mockResolvedValue({
                id: 'eng-100',
                fiOrgId: 'fi-org-1',
                clientLEId: 'cle-1',
                status: 'ACTIVE',
                dueDate: new Date('2026-12-31'),
                org: { id: 'fi-org-1', name: 'First National Bank' },
                clientLE: { id: 'cle-1', name: 'Acme Holdings Ltd' },
                questionnaireInstances: [{ id: 'q-1' }, { id: 'q-2' }],
            });

            const summary = await getRelationshipSummary(actor, 'eng-100');

            expect(summary).toEqual({
                id: 'eng-100',
                fiOrgId: 'fi-org-1',
                fiOrgName: 'First National Bank',
                clientLEId: 'cle-1',
                clientLEName: 'Acme Holdings Ltd',
                status: 'ACTIVE',
                dueDate: new Date('2026-12-31'),
                questionnaireCount: 2,
            });
            expect(prisma.fIEngagement.findFirst).toHaveBeenCalledWith({
                where: { id: 'eng-100', isDeleted: false },
                include: {
                    org: { select: { id: true, name: true } },
                    clientLE: { select: { id: true, name: true } },
                    questionnaireInstances: {
                        where: { isDeleted: false },
                        select: { id: true },
                    },
                },
            });
        });
    });
});
