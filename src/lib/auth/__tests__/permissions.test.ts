import { describe, it, expect, vi } from 'vitest';
import { can, Action, Role, UserWithMemberships } from '../permissions';

describe('Permissions Engine - can()', () => {
    const mockPrisma = {
        clientLEOwner: {
            findMany: vi.fn().mockResolvedValue([])
        },
        fIEngagement: {
            findUnique: vi.fn().mockResolvedValue(null)
        }
    };

    const createUser = (memberships: UserWithMemberships['memberships']): UserWithMemberships => ({
        id: 'user-1',
        memberships
    });

    it('should deny engagement access if engagementId is not provided for eng:* actions', async () => {
        const user = createUser([{ role: Role.RELATIONSHIP_ADMIN, fiEngagementId: 'eng-1' }]);
        // Passing clientLEId instead of engagementId
        const result = await can(user, Action.ENG_UPDATE, { clientLEId: 'le-1' }, mockPrisma);
        expect(result).toBe(false);
    });

    it('should allow RELATIONSHIP_ADMIN to update engagement if engagementId matches explicitly', async () => {
        const user = createUser([{ role: Role.RELATIONSHIP_ADMIN, fiEngagementId: 'eng-1' }]);
        const result = await can(user, Action.ENG_UPDATE, { engagementId: 'eng-1' }, mockPrisma);
        expect(result).toBe(true);
    });

    it('should deny RELATIONSHIP_ADMIN access to a different engagement', async () => {
        const user = createUser([{ role: Role.RELATIONSHIP_ADMIN, fiEngagementId: 'eng-1' }]);
        const result = await can(user, Action.ENG_UPDATE, { engagementId: 'eng-2' }, mockPrisma);
        expect(result).toBe(false);
    });

    it('should allow Client LE_ADMIN downward inheritance to engagements', async () => {
        const user = createUser([{ role: Role.LE_ADMIN, clientLEId: 'le-1' }]);
        
        // Mock Prisma to return the clientLEId for the requested engagement
        mockPrisma.fIEngagement.findUnique.mockResolvedValueOnce({ clientLEId: 'le-1' });

        const result = await can(user, Action.ENG_UPDATE, { engagementId: 'eng-1' }, mockPrisma);
        expect(result).toBe(true);
        expect(mockPrisma.fIEngagement.findUnique).toHaveBeenCalledWith({
            where: { id: 'eng-1' },
            select: { clientLEId: true }
        });
    });

    it('should deny SUPPLIER_ADMIN access to engagement data automatically', async () => {
        // FI Admin holds ORG scope, not engagement scope
        const user = createUser([{ role: Role.SUPPLIER_ADMIN, organizationId: 'fi-org-1' }]);
        
        const result = await can(user, Action.ENG_UPDATE, { engagementId: 'eng-1' }, mockPrisma);
        expect(result).toBe(false);
    });

    it('should allow ORG_ADMIN downward inheritance if they own the ClientLE linked to the engagement', async () => {
        const user = createUser([{ role: Role.ORG_ADMIN, organizationId: 'client-org-1' }]);
        
        mockPrisma.fIEngagement.findUnique.mockResolvedValueOnce({ clientLEId: 'le-1' });
        mockPrisma.clientLEOwner.findMany.mockResolvedValueOnce([{ partyId: 'client-org-1' }]);

        const result = await can(user, Action.ENG_UPDATE, { engagementId: 'eng-1' }, mockPrisma);
        expect(result).toBe(true);
    });
});
