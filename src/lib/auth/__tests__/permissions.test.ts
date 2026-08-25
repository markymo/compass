import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, Action, Role, UserWithMemberships } from '../permissions';

describe('Permissions Engine - can()', () => {
    const mockPrisma = {
        clientLEOwner: {
            findMany: vi.fn().mockResolvedValue([])
        },
        fIEngagement: {
            findUnique: vi.fn().mockResolvedValue(null)
        },
        clientLE: {
            findUnique: vi.fn().mockResolvedValue(null)
        },
        organization: {
            findUnique: vi.fn().mockResolvedValue(null)
        }
    };

    const createUser = (memberships: UserWithMemberships['memberships']): UserWithMemberships => ({
        id: 'user-1',
        memberships
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.clientLEOwner.findMany.mockResolvedValue([]);
        mockPrisma.fIEngagement.findUnique.mockResolvedValue({ clientLEId: 'le-1' });
        mockPrisma.clientLE.findUnique.mockResolvedValue({ isDeleted: false });
        mockPrisma.organization.findUnique.mockResolvedValue(null);
    });

    describe('Engagement Boundary Checks', () => {
        it('should deny engagement access if engagementId is not provided for eng:* actions', async () => {
            const user = createUser([{ role: Role.RELATIONSHIP_ADMIN, fiEngagementId: 'eng-1' }]);
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

        it('should deny Supplier ORG_ADMIN access to engagement data without explicit relationship membership', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'fi-org-1',
                organization: { types: ['SUPPLIER', 'FI'] }
            }]);
            const result = await can(user, Action.ENG_UPDATE, { engagementId: 'eng-1' }, mockPrisma);
            expect(result).toBe(false);
        });
    });

    describe('1. ORG_ADMIN — Operational Isolation (Denied Master Data & Engagement Responses)', () => {
        it('should DENY ORG_ADMIN LE_VIEW_MASTER_DATA on owned ClientLE without direct LE membership', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'client-org-1',
                organization: { types: ['CLIENT'] }
            }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValueOnce([{ partyId: 'client-org-1', party: { types: ['CLIENT'] } }]);

            const result = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            expect(result).toBe(false);
        });

        it('should DENY ORG_ADMIN LE_EDIT_MASTER_DATA and LE_SIGNOFF_MASTER_DATA on owned ClientLE', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'client-org-1',
                organization: { types: ['CLIENT'] }
            }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'client-org-1', party: { types: ['CLIENT'] } }]);

            const editResult = await can(user, Action.LE_EDIT_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            const signoffResult = await can(user, Action.LE_SIGNOFF_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);

            expect(editResult).toBe(false);
            expect(signoffResult).toBe(false);
        });

        it('should DENY ORG_ADMIN downward operational engagement access (view, edit draft, signoff)', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'client-org-1',
                organization: { types: ['CLIENT'] }
            }]);
            mockPrisma.fIEngagement.findUnique.mockResolvedValue({ clientLEId: 'le-1' });
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'client-org-1', party: { types: ['CLIENT'] } }]);

            const viewResult = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-1' }, mockPrisma);
            const editResult = await can(user, Action.ENG_EDIT_DRAFT_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);
            const signoffResult = await can(user, Action.ENG_SIGNOFF_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);

            expect(viewResult).toBe(false);
            expect(editResult).toBe(false);
            expect(signoffResult).toBe(false);
        });
    });

    describe('2. ORG_ADMIN — Client Organizations (types: ["CLIENT"])', () => {
        it('should ALLOW Client ORG_ADMIN common org actions and ClientLE creation', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'client-org-1',
                organization: { types: ['CLIENT'] }
            }]);

            const teamResult = await can(user, Action.ORG_MANAGE_TEAM, { partyId: 'client-org-1' }, mockPrisma);
            const billingResult = await can(user, Action.ORG_MANAGE_BILLING, { partyId: 'client-org-1' }, mockPrisma);
            const createLEResult = await can(user, Action.LE_CREATE, { partyId: 'client-org-1' }, mockPrisma);

            expect(teamResult).toBe(true);
            expect(billingResult).toBe(true);
            expect(createLEResult).toBe(true);
        });

        it('should ALLOW Client ORG_ADMIN structural LE administration on owned ClientLEs', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'client-org-1',
                organization: { types: ['CLIENT'] }
            }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{
                partyId: 'client-org-1',
                party: { types: ['CLIENT'] }
            }]);

            const updateResult = await can(user, Action.LE_UPDATE, { clientLEId: 'le-1' }, mockPrisma);
            const archiveResult = await can(user, Action.LE_ARCHIVE, { clientLEId: 'le-1' }, mockPrisma);
            const manageUsersResult = await can(user, Action.LE_MANAGE_USERS, { clientLEId: 'le-1' }, mockPrisma);
            const selfJoinResult = await can(user, Action.ORG_SELF_JOIN_LE, { clientLEId: 'le-1' }, mockPrisma);

            expect(updateResult).toBe(true);
            expect(archiveResult).toBe(true);
            expect(manageUsersResult).toBe(true);
            expect(selfJoinResult).toBe(true);
        });

        it('should DENY Client-only ORG_ADMIN Supplier questionnaire-library administration', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'client-org-1',
                organization: { types: ['CLIENT'] }
            }]);

            const createQResult = await can(user, Action.QUESTIONNAIRE_CREATE, { partyId: 'client-org-1' }, mockPrisma);
            const updateQResult = await can(user, Action.QUESTIONNAIRE_UPDATE, { partyId: 'client-org-1' }, mockPrisma);
            const deleteQResult = await can(user, Action.QUESTIONNAIRE_DELETE, { partyId: 'client-org-1' }, mockPrisma);

            expect(createQResult).toBe(false);
            expect(updateQResult).toBe(false);
            expect(deleteQResult).toBe(false);
        });
    });

    describe('3. ORG_ADMIN — Supplier Organizations (types: ["SUPPLIER", "FI", "LAW_FIRM", "OTHER"])', () => {
        it('should ALLOW Supplier ORG_ADMIN common org actions and questionnaire-library administration', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'supplier-org-1',
                organization: { types: ['SUPPLIER'] }
            }]);

            const teamResult = await can(user, Action.ORG_MANAGE_TEAM, { partyId: 'supplier-org-1' }, mockPrisma);
            const billingResult = await can(user, Action.ORG_MANAGE_BILLING, { partyId: 'supplier-org-1' }, mockPrisma);
            const createQResult = await can(user, Action.QUESTIONNAIRE_CREATE, { partyId: 'supplier-org-1' }, mockPrisma);
            const updateQResult = await can(user, Action.QUESTIONNAIRE_UPDATE, { partyId: 'supplier-org-1' }, mockPrisma);
            const deleteQResult = await can(user, Action.QUESTIONNAIRE_DELETE, { partyId: 'supplier-org-1' }, mockPrisma);

            expect(teamResult).toBe(true);
            expect(billingResult).toBe(true);
            expect(createQResult).toBe(true);
            expect(updateQResult).toBe(true);
            expect(deleteQResult).toBe(true);
        });

        it('should ALLOW FI, LAW_FIRM, and OTHER subtype ORG_ADMINs questionnaire-library administration', async () => {
            for (const subtype of ['FI', 'LAW_FIRM', 'OTHER']) {
                const user = createUser([{
                    role: Role.ORG_ADMIN,
                    organizationId: `org-${subtype}`,
                    organization: { types: [subtype] }
                }]);

                const createQ = await can(user, Action.QUESTIONNAIRE_CREATE, { partyId: `org-${subtype}` }, mockPrisma);
                expect(createQ).toBe(true);
            }
        });

        it('should DENY Supplier-only ORG_ADMIN ClientLE creation and structural LE administration', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'supplier-org-1',
                organization: { types: ['SUPPLIER', 'FI'] }
            }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{
                partyId: 'supplier-org-1',
                party: { types: ['SUPPLIER', 'FI'] }
            }]);

            const createLEResult = await can(user, Action.LE_CREATE, { partyId: 'supplier-org-1' }, mockPrisma);
            const updateLEResult = await can(user, Action.LE_UPDATE, { clientLEId: 'le-1' }, mockPrisma);
            const archiveLEResult = await can(user, Action.LE_ARCHIVE, { clientLEId: 'le-1' }, mockPrisma);
            const manageUsersResult = await can(user, Action.LE_MANAGE_USERS, { clientLEId: 'le-1' }, mockPrisma);

            expect(createLEResult).toBe(false);
            expect(updateLEResult).toBe(false);
            expect(archiveLEResult).toBe(false);
            expect(manageUsersResult).toBe(false);
        });
    });

    describe('4. ORG_ADMIN — Multi-type Organizations (types: ["CLIENT", "SUPPLIER"])', () => {
        it('should ALLOW multi-type ORG_ADMIN both ClientLE structural administration and questionnaire-library administration', async () => {
            const user = createUser([{
                role: Role.ORG_ADMIN,
                organizationId: 'hybrid-org-1',
                organization: { types: ['CLIENT', 'SUPPLIER'] }
            }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{
                partyId: 'hybrid-org-1',
                party: { types: ['CLIENT', 'SUPPLIER'] }
            }]);

            const teamResult = await can(user, Action.ORG_MANAGE_TEAM, { partyId: 'hybrid-org-1' }, mockPrisma);
            const createLEResult = await can(user, Action.LE_CREATE, { partyId: 'hybrid-org-1' }, mockPrisma);
            const updateLEResult = await can(user, Action.LE_UPDATE, { clientLEId: 'le-1' }, mockPrisma);
            const createQResult = await can(user, Action.QUESTIONNAIRE_CREATE, { partyId: 'hybrid-org-1' }, mockPrisma);

            expect(teamResult).toBe(true);
            expect(createLEResult).toBe(true);
            expect(updateLEResult).toBe(true);
            expect(createQResult).toBe(true);
        });
    });

    describe('5. Explicit LE Membership Grants Operational & Structural Access Independently', () => {
        it('allows user who is BOTH ORG_ADMIN and LE_ADMIN on ClientLE A full operational access', async () => {
            const user = createUser([
                { role: Role.ORG_ADMIN, organizationId: 'client-org-1', organization: { types: ['CLIENT'] } },
                { role: Role.LE_ADMIN, clientLEId: 'le-1' }
            ]);

            const viewResult = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            const editResult = await can(user, Action.LE_EDIT_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            const signoffResult = await can(user, Action.LE_SIGNOFF_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);

            expect(viewResult).toBe(true);
            expect(editResult).toBe(true);
            expect(signoffResult).toBe(true);
        });

        it('allows user who is ORG_ADMIN and LE_USER on ClientLE A normal LE_USER rights, but denies signoff', async () => {
            const user = createUser([
                { role: Role.ORG_ADMIN, organizationId: 'client-org-1', organization: { types: ['CLIENT'] } },
                { role: Role.LE_USER, clientLEId: 'le-1' }
            ]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'client-org-1', party: { types: ['CLIENT'] } }]);

            const viewResult = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            const editResult = await can(user, Action.LE_EDIT_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            const signoffResult = await can(user, Action.LE_SIGNOFF_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);

            expect(viewResult).toBe(true);
            expect(editResult).toBe(true);
            expect(signoffResult).toBe(false); // ORG_ADMIN does not grant signoff to LE_USER
        });

        it('allows direct LE_ADMIN to perform structural LE actions even without Org type matching', async () => {
            // Direct LE_ADMIN role on the ClientLE should work independently of org type gating
            const user = createUser([
                { role: Role.LE_ADMIN, clientLEId: 'le-1' }
            ]);

            const updateResult = await can(user, Action.LE_UPDATE, { clientLEId: 'le-1' }, mockPrisma);
            const archiveResult = await can(user, Action.LE_ARCHIVE, { clientLEId: 'le-1' }, mockPrisma);
            const manageUsersResult = await can(user, Action.LE_MANAGE_USERS, { clientLEId: 'le-1' }, mockPrisma);

            expect(updateResult).toBe(true);
            expect(archiveResult).toBe(true);
            expect(manageUsersResult).toBe(true);
        });

        it('denies user who is ORG_ADMIN on Org A from accessing operational data of ClientLE B owned by Org A (without LE B membership)', async () => {
            const user = createUser([
                { role: Role.ORG_ADMIN, organizationId: 'client-org-1', organization: { types: ['CLIENT'] } },
                { role: Role.LE_ADMIN, clientLEId: 'le-1' } // Member only on le-1, not le-2
            ]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'client-org-1', party: { types: ['CLIENT'] } }]);

            // Checking le-2 (same owning org, but no direct LE membership on le-2)
            const result = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-2' }, mockPrisma);
            expect(result).toBe(false);
        });
    });

    describe('6. ORG_MEMBER — No Operational or Administrative Access', () => {
        it('DENIES ORG_MEMBER Master Data, relationship data, and administrative actions', async () => {
            const user = createUser([{ role: Role.ORG_MEMBER, organizationId: 'client-org-1', organization: { types: ['CLIENT'] } }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'client-org-1', party: { types: ['CLIENT'] } }]);
            mockPrisma.fIEngagement.findUnique.mockResolvedValue({ clientLEId: 'le-1' });

            const masterViewResult = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            const engViewResult = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-1' }, mockPrisma);
            const engEditResult = await can(user, Action.ENG_EDIT_DRAFT_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);
            const teamResult = await can(user, Action.ORG_MANAGE_TEAM, { partyId: 'client-org-1' }, mockPrisma);
            const createLEResult = await can(user, Action.LE_CREATE, { partyId: 'client-org-1' }, mockPrisma);

            expect(masterViewResult).toBe(false);
            expect(engViewResult).toBe(false);
            expect(engEditResult).toBe(false);
            expect(teamResult).toBe(false);
            expect(createLEResult).toBe(false);
        });
    });

    describe('7. Client-Side LE Downward Inheritance (LE_ADMIN & LE_USER)', () => {
        it('should allow Client LE_ADMIN downward inheritance to engagements (view, edit, signoff)', async () => {
            const user = createUser([{ role: Role.LE_ADMIN, clientLEId: 'le-1' }]);
            mockPrisma.fIEngagement.findUnique.mockResolvedValue({ clientLEId: 'le-1' });

            const viewResult = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-1' }, mockPrisma);
            const editResult = await can(user, Action.ENG_EDIT_DRAFT_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);
            const signoffResult = await can(user, Action.ENG_SIGNOFF_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);
            const manageUsersResult = await can(user, Action.ENG_MANAGE_USERS, { engagementId: 'eng-1' }, mockPrisma);

            expect(viewResult).toBe(true);
            expect(editResult).toBe(true);
            expect(signoffResult).toBe(true);
            expect(manageUsersResult).toBe(true);
        });

        it('should allow Client LE_USER downward inheritance for non-signoff engagement actions', async () => {
            const user = createUser([{ role: Role.LE_USER, clientLEId: 'le-1' }]);
            mockPrisma.fIEngagement.findUnique.mockResolvedValue({ clientLEId: 'le-1' });

            const viewResult = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-1' }, mockPrisma);
            const editResult = await can(user, Action.ENG_EDIT_DRAFT_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);
            const signoffResult = await can(user, Action.ENG_SIGNOFF_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);

            expect(viewResult).toBe(true);
            expect(editResult).toBe(true);
            expect(signoffResult).toBe(false); // LE_USER cannot sign off
        });
    });

    describe('8. Supplier Relationship Roles Scoping', () => {
        it('should allow RELATIONSHIP_ADMIN to ENG_VIEW_RELEASED_DATA on assigned engagement', async () => {
            const user = createUser([{ role: Role.RELATIONSHIP_ADMIN, fiEngagementId: 'eng-1' }]);
            const result = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-1' }, mockPrisma);
            expect(result).toBe(true);
        });

        it('should NOT allow RELATIONSHIP_ADMIN to LE_VIEW_MASTER_DATA', async () => {
            const user = createUser([{ role: Role.RELATIONSHIP_ADMIN, fiEngagementId: 'eng-1' }]);
            const result = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-1' }, mockPrisma);
            expect(result).toBe(false);
        });

        it('should allow RELATIONSHIP_USER to ENG_VIEW_RELEASED_DATA but NOT ENG_SIGNOFF_RESPONSES', async () => {
            const user = createUser([{ role: Role.RELATIONSHIP_USER, fiEngagementId: 'eng-1' }]);
            const viewResult = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: 'eng-1' }, mockPrisma);
            const signoffResult = await can(user, Action.ENG_SIGNOFF_RESPONSES, { engagementId: 'eng-1' }, mockPrisma);
            
            expect(viewResult).toBe(true);
            expect(signoffResult).toBe(false);
        });

        it('should allow RELATIONSHIP_ADMIN QUESTIONNAIRE_UPDATE within relationship without org-level gating', async () => {
            const user = createUser([{ role: Role.RELATIONSHIP_ADMIN, fiEngagementId: 'eng-1' }]);
            const result = await can(user, Action.QUESTIONNAIRE_UPDATE, { engagementId: 'eng-1' }, mockPrisma);
            expect(result).toBe(true);
        });
    });

    describe('9. Isolation & Cross-Tenant Protection', () => {
        it('should DENY Org A ORG_ADMIN operational access to ClientLE owned by Org B', async () => {
            const user = createUser([{ role: Role.ORG_ADMIN, organizationId: 'client-org-a', organization: { types: ['CLIENT'] } }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValueOnce([{ partyId: 'client-org-b', party: { types: ['CLIENT'] } }]);

            const result = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-b' }, mockPrisma);
            expect(result).toBe(false);
        });

        it('should DENY Org A ORG_ADMIN structural access to ClientLE owned by Org B', async () => {
            const user = createUser([{ role: Role.ORG_ADMIN, organizationId: 'client-org-a', organization: { types: ['CLIENT'] } }]);
            mockPrisma.clientLEOwner.findMany.mockResolvedValueOnce([{ partyId: 'client-org-b', party: { types: ['CLIENT'] } }]);

            const result = await can(user, Action.LE_UPDATE, { clientLEId: 'le-b' }, mockPrisma);
            expect(result).toBe(false);
        });
    });
});
