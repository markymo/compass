import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { inviteSupplier } from '../supplier-invitations';
import { inviteUser, revokeInvitation, resendInvitation } from '../invitations';
import { updateMembershipRole, removeMembership } from '../memberships';
import { determineRedirectUrl, registerAndAcceptInvitation, acceptInvitation } from '../accept-invitation';
import { Action, can, Role } from '@/lib/auth/permissions';
import { getFIPortalTabs } from '@/config/navigation-tabs';
import crypto from 'crypto';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        organization: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
        clientLE: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
        clientLEOwner: { findFirst: vi.fn(), findMany: vi.fn() },
        fIEngagement: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
        invitation: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        user: { findUnique: vi.fn(), create: vi.fn() },
        engagementActivity: { create: vi.fn() },
        question: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        $transaction: vi.fn(),
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma,
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed_pwd_123'),
        compare: vi.fn().mockResolvedValue(true),
    },
}));

const prismaMock = prisma as any;

describe('ONP-173 — Supplier Team Membership & Invitation Onboarding Workflow', () => {
    const supplierOrgAId = 'supplier-org-a';
    const supplierOrgBId = 'supplier-org-b';
    const clientLEId = 'le-alpha-id';
    const engagementAId = 'eng-alpha-a';
    const engagementBId = 'eng-beta-b';

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
        prismaMock.clientLE.findUnique.mockResolvedValue({ id: clientLEId, isDeleted: false, name: 'Client LE Alpha' });
        prismaMock.fIEngagement.findUnique.mockResolvedValue({
            id: engagementAId,
            fiOrgId: supplierOrgAId,
            clientLEId,
            status: 'CONNECTED',
            clientLE: { id: clientLEId, name: 'Client LE Alpha', isDeleted: false },
            org: { id: supplierOrgAId, name: 'Supplier Org A', types: ['SUPPLIER', 'FI'] },
        });
    });

    // ========================================================================
    // Journey 1 — Existing OnPro User Added to Relationship Team
    // ========================================================================
    describe('Journey 1 — Existing OnPro User Added to Relationship Team', () => {
        it('Desired contract: Existing user with LE_ADMIN is granted RELATIONSHIP_ADMIN immediately with 0 invitations created', async () => {
            const existingEmail = 'fred.existing@onpro.tech';
            const existingUserId = 'user-fred-existing';

            // Requester is Supplier ORG_ADMIN
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-admin-1', email: 'admin@supplier-a.com' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { id: 'mem-admin', userId: 'supplier-admin-1', organizationId: supplierOrgAId, role: 'ORG_ADMIN', organization: { types: ['SUPPLIER', 'FI'] } },
            ]);
            prismaMock.organization.findUnique.mockResolvedValue({
                id: supplierOrgAId,
                name: 'Supplier Org A',
                types: ['SUPPLIER', 'FI'],
            });

            // Existing user exists in database with an active LE_ADMIN membership on ClientLE
            prismaMock.user.findUnique.mockResolvedValue({
                id: existingUserId,
                email: existingEmail,
                name: 'Fred Existing',
            });

            prismaMock.fIEngagement.findUnique.mockResolvedValue({
                id: engagementAId,
                fiOrgId: supplierOrgAId,
                clientLEId,
                status: 'CONNECTED',
                clientLE: { id: clientLEId, name: 'Client LE Alpha' },
                org: { id: supplierOrgAId, name: 'Supplier Org A', types: ['SUPPLIER', 'FI'] },
            });

            // Target user is not yet a member of engagement A
            prismaMock.membership.findFirst.mockResolvedValue(null);

            // Desired contract: Calling relationship add/invite for an existing user
            // MUST check if user exists and create Relationship Membership immediately,
            // creating ZERO new Invitation records.
            // Currently, inviteSupplier always creates an Invitation record and never creates Membership:
            const result = await inviteSupplier(engagementAId, existingEmail, 'RELATIONSHIP_ADMIN');

            // AUTHORITATIVE RED ASSERTIONS:
            // 1. Zero new Invitation records for this access grant
            expect(prismaMock.invitation.create).not.toHaveBeenCalled();

            // 2. Relationship Membership created immediately
            expect(prismaMock.membership.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: existingUserId,
                        fiEngagementId: engagementAId,
                        role: 'RELATIONSHIP_ADMIN',
                    }),
                })
            );
        });
    });

    // ========================================================================
    // Journey 2 — New User Pending → Accepted
    // ========================================================================
    describe('Journey 2 — New User Pending → Accepted', () => {
        it('Step A (Pre-acceptance): Unknown email creates Pending Invitation with explicit RELATIONSHIP_USER and 0 memberships', async () => {
            const unknownEmail = 'stranger.new@company.com';

            // When Client LE Admin invites an unknown supplier contact:
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'client-admin-1', email: 'admin@alpha-client.com' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { id: 'mem-client-admin', userId: 'client-admin-1', clientLEId, role: 'LE_ADMIN', clientLE: { isDeleted: false } },
            ]);

            // User does NOT exist in database
            prismaMock.user.findUnique.mockResolvedValue(null);

            prismaMock.invitation.findFirst.mockResolvedValue(null);
            prismaMock.invitation.create.mockResolvedValue({
                id: 'inv-stranger-1',
                sentToEmail: unknownEmail,
                role: 'RELATIONSHIP_USER',
                fiEngagementId: engagementAId,
            });

            // Note: inviteSupplier currently accepts role parameter (defaulting to RELATIONSHIP_ADMIN)
            const result = await inviteSupplier(engagementAId, unknownEmail, 'RELATIONSHIP_USER');

            expect(result.success).toBe(true);

            // Assert Pending Invitation created with correct scope and explicit role
            expect(prismaMock.invitation.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    sentToEmail: unknownEmail,
                    role: 'RELATIONSHIP_USER',
                    fiEngagementId: engagementAId,
                    tokenHash: expect.any(String),
                    expiresAt: expect.any(Date),
                }),
            });

            // Assert NO membership created prior to token acceptance
            expect(prismaMock.membership.create).not.toHaveBeenCalled();
        });

        it('Step B (Acceptance): Registration creates User, assigns RELATIONSHIP_USER, marks invite used, and lands on Supplier route', async () => {
            const rawToken = 'valid-supplier-token-456';
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const newEmail = 'stranger.new@company.com';

            const pendingInvite = {
                id: 'inv-stranger-1',
                sentToEmail: newEmail,
                role: 'RELATIONSHIP_USER',
                tokenHash,
                fiEngagementId: engagementAId,
                expiresAt: new Date(Date.now() + 86400000),
                usedAt: null,
                revokedAt: null,
                fiEngagement: {
                    id: engagementAId,
                    fiOrgId: supplierOrgAId,
                    status: 'CONNECTED',
                    org: { id: supplierOrgAId, name: 'Supplier Org A' },
                    clientLE: { id: clientLEId, name: 'Client LE Alpha' },
                },
            };

            prismaMock.invitation.findUnique.mockResolvedValue(pendingInvite);
            prismaMock.user.findUnique.mockResolvedValue(null); // User does not exist yet

            prismaMock.user.create.mockResolvedValue({
                id: 'user-new-created',
                email: newEmail,
                name: 'Stranger New',
            });

            prismaMock.membership.create.mockResolvedValue({
                id: 'mem-new-rel',
                userId: 'user-new-created',
                fiEngagementId: engagementAId,
                role: 'RELATIONSHIP_USER',
            });

            prismaMock.invitation.update.mockResolvedValue({
                ...pendingInvite,
                usedAt: new Date(),
                acceptedByUserId: 'user-new-created',
            });

            const acceptResult = await registerAndAcceptInvitation({
                token: rawToken,
                password: 'SecretPassword123!',
                name: 'Stranger New',
            });
            if (!acceptResult.success) {
                console.log("acceptResult error:", acceptResult.error);
            }
            expect(acceptResult.success).toBe(true);
            expect(acceptResult.redirectUrl).toBe(`/app/s/${supplierOrgAId}`);

            // Assert Membership created with role RELATIONSHIP_USER
            expect(prismaMock.membership.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-new-created',
                    fiEngagementId: engagementAId,
                    role: 'RELATIONSHIP_USER',
                }),
            });

            // Assert Invitation marked used
            expect(prismaMock.invitation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'inv-stranger-1' },
                    data: expect.objectContaining({
                        usedAt: expect.any(Date),
                        acceptedByUserId: 'user-new-created',
                    }),
                })
            );
        });
    });

    // ========================================================================
    // Journey 3 — Mixed Client + Two Supplier Contexts (Fred Architecture)
    // ========================================================================
    describe('Journey 3 — Mixed Client + Two Supplier Contexts (Fred Architecture)', () => {
        it('Coexistence: One User holds LE_ADMIN on ClientLE X, RELATIONSHIP_ADMIN on Supplier A, and RELATIONSHIP_USER on Supplier B', async () => {
            const fredUser = {
                id: 'fred-multi-context',
                email: 'fred@onpro.tech',
                memberships: [
                    { clientLEId: 'le-x', role: Role.LE_ADMIN },
                    { fiEngagementId: engagementAId, role: Role.RELATIONSHIP_ADMIN },
                    { fiEngagementId: engagementBId, role: Role.RELATIONSHIP_USER },
                ],
            };

            // Assert all three grants coexist independently
            expect(fredUser.memberships).toHaveLength(3);

            // Assert permissions on each context
            // 1. Client LE X: LE_ADMIN can view Master Data
            const canClient = await can(fredUser as any, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-x' }, prismaMock);
            expect(canClient).toBe(true);

            // 2. Supplier A Engagement A: RELATIONSHIP_ADMIN can manage relationship users
            const canRelAdminA = await can(fredUser as any, Action.ENG_MANAGE_USERS, { engagementId: engagementAId }, prismaMock);
            expect(canRelAdminA).toBe(true);

            // 3. Supplier B Engagement B: RELATIONSHIP_USER can view engagement data
            const canRelUserB = await can(fredUser as any, Action.ENG_VIEW, { engagementId: engagementBId }, prismaMock);
            expect(canRelUserB).toBe(true);

            // 4. Supplier B Engagement B: RELATIONSHIP_USER cannot manage relationship users
            const canManageRelB = await can(fredUser as any, Action.ENG_MANAGE_USERS, { engagementId: engagementBId }, prismaMock);
            expect(canManageRelB).toBe(false);
        });

        it('Independent Removal: Removing Supplier A Relationship membership preserves ClientLE X and Supplier B memberships', async () => {
            const initialMemberships = [
                { id: 'mem-1', userId: 'fred', clientLEId: 'le-x', fiEngagementId: null, role: Role.LE_ADMIN },
                { id: 'mem-2', userId: 'fred', clientLEId: null, fiEngagementId: engagementAId, role: Role.RELATIONSHIP_ADMIN },
                { id: 'mem-3', userId: 'fred', clientLEId: null, fiEngagementId: engagementBId, role: Role.RELATIONSHIP_USER },
            ];

            // When Relationship A access is removed, only mem-2 must be deleted
            const remainingMemberships = initialMemberships.filter((m) => m.fiEngagementId !== engagementAId);

            expect(remainingMemberships).toHaveLength(2);
            expect(remainingMemberships.find((m) => m.clientLEId === 'le-x')?.role).toBe(Role.LE_ADMIN);
            expect(remainingMemberships.find((m) => m.fiEngagementId === engagementBId)?.role).toBe(Role.RELATIONSHIP_USER);

            const updatedFred = { id: 'fred', memberships: remainingMemberships };

            // Supplier A Relationship access is now denied
            const canRelA = await can(updatedFred as any, Action.ENG_VIEW, { engagementId: engagementAId }, prismaMock);
            expect(canRelA).toBe(false);

            // ClientLE X access remains granted
            const canClient = await can(updatedFred as any, Action.LE_VIEW_MASTER_DATA, { clientLEId: 'le-x' }, prismaMock);
            expect(canClient).toBe(true);

            // Supplier B access remains granted
            const canRelB = await can(updatedFred as any, Action.ENG_VIEW, { engagementId: engagementBId }, prismaMock);
            expect(canRelB).toBe(true);
        });
    });

    // ========================================================================
    // Journey 4 — Relationship Team Lifecycle (Role Change, Remove Access, Revoke, Resend)
    // ========================================================================
    describe('Journey 4 — Relationship Team Lifecycle', () => {
        it('Active Membership Role Change: updateMembershipRole should allow changing RELATIONSHIP_USER to RELATIONSHIP_ADMIN', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-admin-1' } as any);

            prismaMock.membership.findUnique.mockResolvedValue({
                id: 'mem-rel-user-1',
                userId: 'user-worker-1',
                fiEngagementId: engagementAId,
                organizationId: null,
                clientLEId: null,
                role: 'RELATIONSHIP_USER',
            });

            // Currently updateMembershipRole in memberships.ts line 120 checks:
            // if (!orgIdToCheck) return { success: false, error: "Not an organization membership" };
            // This is RED for relationship memberships!
            const result = await updateMembershipRole('mem-rel-user-1', 'RELATIONSHIP_ADMIN');

            // AUTHORITATIVE RED ASSERTION:
            expect(result.success).toBe(true);
            expect(prismaMock.membership.update).toHaveBeenCalledWith({
                where: { id: 'mem-rel-user-1' },
                data: { role: 'RELATIONSHIP_ADMIN' },
            });
        });

        it('Active Membership Removal: removeMembership should allow removing relationship access', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-admin-1' } as any);

            prismaMock.membership.findUnique.mockResolvedValue({
                id: 'mem-rel-user-1',
                userId: 'user-worker-1',
                fiEngagementId: engagementAId,
                organizationId: null,
                clientLEId: null,
                role: 'RELATIONSHIP_USER',
            });

            // Currently removeMembership in memberships.ts line 150 checks:
            // if (!orgIdToCheck) return { success: false, error: "Not an organization membership" };
            // This is RED for relationship memberships!
            const result = await removeMembership('mem-rel-user-1');

            // AUTHORITATIVE RED ASSERTION:
            expect(result.success).toBe(true);
            expect(prismaMock.membership.delete).toHaveBeenCalledWith({
                where: { id: 'mem-rel-user-1' },
            });
        });

        it('Pending Invitation Revoke: Supplier ORG_ADMIN or RELATIONSHIP_ADMIN can revoke relationship invitation', async () => {
            // Caller is Supplier ORG_ADMIN, not the original inviter
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-admin-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { id: 'mem-admin', userId: 'supplier-admin-1', organizationId: supplierOrgAId, role: 'ORG_ADMIN', organization: { types: ['SUPPLIER', 'FI'] } },
            ]);
            prismaMock.organization.findUnique.mockResolvedValue({
                id: supplierOrgAId,
                name: 'Supplier Org A',
                types: ['SUPPLIER', 'FI'],
            });
            prismaMock.fIEngagement.findUnique.mockResolvedValue({
                id: engagementAId,
                fiOrgId: supplierOrgAId,
                clientLEId,
                status: 'CONNECTED',
                clientLE: { id: clientLEId, name: 'Client LE Alpha' },
                org: { id: supplierOrgAId, name: 'Supplier Org A', types: ['SUPPLIER', 'FI'] },
            });

            prismaMock.invitation.findUnique.mockResolvedValue({
                id: 'inv-rel-1',
                sentToEmail: 'pending@bank.com',
                fiEngagementId: engagementAId,
                organizationId: null,
                clientLEId: null,
                createdByUserId: 'different-admin-id',
                usedAt: null,
                revokedAt: null,
                expiresAt: new Date(Date.now() + 86400000),
            });

            const result = await revokeInvitation('inv-rel-1');

            expect(result.success).toBe(true);
            expect(prismaMock.invitation.update).toHaveBeenCalledWith({
                where: { id: 'inv-rel-1' },
                data: { revokedAt: expect.any(Date) },
            });
        });

        it('Pending Invitation Resend / Recovery: Resend should deliver a fresh invitation or rotated recoverable link', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'supplier-admin-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { id: 'mem-admin', userId: 'supplier-admin-1', organizationId: supplierOrgAId, role: 'ORG_ADMIN', organization: { types: ['SUPPLIER', 'FI'] } },
            ]);
            prismaMock.organization.findUnique.mockResolvedValue({
                id: supplierOrgAId,
                name: 'Supplier Org A',
                types: ['SUPPLIER', 'FI'],
            });
            prismaMock.fIEngagement.findUnique.mockResolvedValue({
                id: engagementAId,
                fiOrgId: supplierOrgAId,
                clientLEId,
                status: 'CONNECTED',
                clientLE: { id: clientLEId, name: 'Client LE Alpha' },
                org: { id: supplierOrgAId, name: 'Supplier Org A', types: ['SUPPLIER', 'FI'] },
            });

            prismaMock.invitation.findUnique.mockResolvedValue({
                id: 'inv-rel-1',
                sentToEmail: 'pending@bank.com',
                fiEngagementId: engagementAId,
                organizationId: null,
                clientLEId: null,
                createdByUserId: 'different-admin-id',
                usedAt: null,
                revokedAt: null,
                expiresAt: new Date(Date.now() + 86400000),
            });

            const result = await resendInvitation('inv-rel-1');

            expect(result.success).toBe(true);
            expect(result.newInviteLink).toContain('/invite/');
        });
    });

    // ========================================================================
    // Journey 5 — Existing User Never Registers Again (Authoritative Contract)
    // ========================================================================
    describe('Journey 5 — Existing User Never Registers Again', () => {
        it('Desired Contract (Authoritative RED): Adding existing user to Relationship creates 0 invites and immediate Membership without token/password journey', async () => {
            const existingEmail = 'already.registered@onpro.tech';
            const existingUserId = 'user-already-exists-123';

            prismaMock.user.findUnique.mockResolvedValue({
                id: existingUserId,
                email: existingEmail,
                name: 'Registered User',
            });

            vi.mocked(getIdentity).mockResolvedValue({ userId: 'admin-1', email: 'admin@onpro.tech' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { id: 'm-client-admin', userId: 'admin-1', clientLEId, role: 'LE_ADMIN', clientLE: { isDeleted: false } },
            ]);

            // When an authorized administrator adds an existing user:
            // Desired contract: Must NOT create an invitation; MUST create membership directly.
            // Under current code, calling inviteSupplier creates an invitation and zero memberships:
            await inviteSupplier(engagementAId, existingEmail, 'RELATIONSHIP_USER');

            // AUTHORITATIVE RED ASSERTIONS:
            // 1. Zero Pending Invitation records created
            expect(prismaMock.invitation.create).not.toHaveBeenCalled();

            // 2. Immediate Relationship Membership created with requested role
            expect(prismaMock.membership.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: existingUserId,
                        fiEngagementId: engagementAId,
                        role: 'RELATIONSHIP_USER',
                    }),
                })
            );
        });

        it('Historical defect reproduction (Reference): Previous inviteSupplier unconditionally created an invitation causing "account already exists" error', async () => {
            const existingEmail = 'already.registered@onpro.tech';
            const fakeToken = 'raw-defect-token-123';
            const tokHash = crypto.createHash('sha256').update(fakeToken).digest('hex');

            // User visits /invite/{token} and submits password:
            prismaMock.invitation.findUnique.mockResolvedValue({
                id: 'inv-err-1',
                sentToEmail: existingEmail,
                tokenHash: tokHash,
                expiresAt: new Date(Date.now() + 86400000),
                usedAt: null,
                revokedAt: null,
                fiEngagementId: engagementAId,
                fiEngagement: { id: engagementAId, fiOrgId: supplierOrgAId },
            });
            prismaMock.user.findUnique.mockResolvedValue({
                id: 'user-already-exists',
                email: existingEmail,
            });

            const acceptRes = await registerAndAcceptInvitation({
                token: fakeToken,
                password: 'NewPassword123!',
                name: 'Registered User',
            });

            // Proof of historical defect:
            expect(acceptRes.success).toBe(false);
            expect(acceptRes.error).toContain('already exists. Please sign in to accept your invitation.');
        });
    });

    // ========================================================================
    // Journey 6 — Post-Onboarding Navigation (Role-Aware Tabs)
    // ========================================================================
    describe('Journey 6 — Post-Onboarding Navigation (Role-Aware)', () => {
        it('Redirect points to Supplier route (/app/s/${fiOrgId})', async () => {
            const mockInvite = {
                fiEngagement: { fiOrgId: supplierOrgAId },
            };

            const redirectUrl = await determineRedirectUrl(mockInvite as any, prismaMock);
            expect(redirectUrl).toBe(`/app/s/${supplierOrgAId}`);
        });

        it('Authoritative RED: Relationship-only users must NOT be offered Supplier Admin tabs; Supplier ORG_ADMIN sees Admin', () => {
            // Role-aware navigation contract:
            // For Relationship-only user (RELATIONSHIP_ADMIN or RELATIONSHIP_USER without Supplier ORG_ADMIN):
            // The Admin tab (/app/s/${orgId}/questionnaires) must NOT be visibly offered!
            // Currently on dev, getFIPortalTabs renders Admin unconditionally for everyone.
            // When updated to be role-aware: getFIPortalTabs(orgId, { isOrgAdmin: false }) must omit Admin!
            const relOnlyTabs = (getFIPortalTabs as any)(supplierOrgAId, { isOrgAdmin: false });
            const hasAdminTabForRelUser = relOnlyTabs.some((t: any) => t.label === 'Admin' || t.href.includes('/questionnaires'));
            expect(hasAdminTabForRelUser, 'Authoritative RED: Relationship-only user must not be offered Supplier Admin tab').toBe(false);

            // For Supplier ORG_ADMIN: Admin tab MUST be present
            const orgAdminTabs = (getFIPortalTabs as any)(supplierOrgAId, { isOrgAdmin: true });
            const hasAdminTabForOrgAdmin = orgAdminTabs.some((t: any) => t.label === 'Admin');
            expect(hasAdminTabForOrgAdmin).toBe(true);
        });
    });

    // ========================================================================
    // Journey 7 — FR-15 Authenticated Pending-Invitation Discovery & Acceptance
    // ========================================================================
    describe('Journey 7 — FR-15 Authenticated Pending-Invitation Discovery & Acceptance', () => {
        it('Authoritative RED: Authenticated user discovers outstanding pending invitation and claims it without token URL', async () => {
            const janeEmail = 'jane.invitee@bank.com';
            const janeUserId = 'user-jane-authenticated';

            vi.mocked(getIdentity).mockResolvedValue({ userId: janeUserId, email: janeEmail } as any);

            const mockJaneInvite = {
                id: 'inv-jane-pending',
                sentToEmail: janeEmail,
                role: 'RELATIONSHIP_USER',
                fiEngagementId: engagementAId,
                expiresAt: new Date(Date.now() + 86400000),
                usedAt: null,
                revokedAt: null,
                fiEngagement: {
                    id: engagementAId,
                    fiOrgId: supplierOrgAId,
                    org: { id: supplierOrgAId, name: 'Supplier Org A' },
                    clientLE: { id: clientLEId, name: 'Client LE Alpha' },
                },
            };

            // Jane has a pending invitation for engagement A
            prismaMock.invitation.findMany.mockResolvedValue([mockJaneInvite]);
            prismaMock.invitation.findUnique.mockResolvedValue(mockJaneInvite as any);

            // Desired contract:
            // 1. Authenticated user can query pending invitations for their email via getAuthenticatedPendingInvitations()
            // 2. Jane can trigger claimPendingInvitation(invitationId) to accept it directly
            const { getAuthenticatedPendingInvitations, claimPendingInvitation } = await import('../invitations') as any;

            // This will RED on current code because getAuthenticatedPendingInvitations / claimPendingInvitation do not exist yet:
            expect(typeof getAuthenticatedPendingInvitations, 'Authoritative RED: getAuthenticatedPendingInvitations must exist').toBe('function');

            const pending = await getAuthenticatedPendingInvitations();
            expect(pending).toHaveLength(1);
            expect(pending[0].id).toBe('inv-jane-pending');

            // Claim/accept the invitation deliberately:
            const claimResult = await claimPendingInvitation('inv-jane-pending');
            expect(claimResult.success).toBe(true);
            expect(claimResult.redirectUrl).toBe(`/app/s/${supplierOrgAId}`);

            // Membership created with RELATIONSHIP_USER:
            expect(prismaMock.membership.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: janeUserId,
                        fiEngagementId: engagementAId,
                        role: 'RELATIONSHIP_USER',
                    }),
                })
            );

            // Invitation marked used:
            expect(prismaMock.invitation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'inv-jane-pending' },
                    data: expect.objectContaining({
                        usedAt: expect.any(Date),
                        acceptedByUserId: janeUserId,
                    }),
                })
            );
        });
    });

    // ========================================================================
    // Journey 8 — Team-Management Authority Matrix
    // ========================================================================
    describe('Journey 8 — Team-Management Authority Matrix', () => {
        it('Client LE_ADMIN: Authorized to manage Relationship Team via LE_MANAGE_USERS on ClientLE', async () => {
            const clientAdmin = {
                id: 'client-admin-user',
                memberships: [{ clientLEId, role: Role.LE_ADMIN, clientLE: { isDeleted: false } }],
            };

            const canManage = await can(clientAdmin as any, Action.ENG_MANAGE_USERS, { clientLEId, engagementId: engagementAId }, prismaMock);
            expect(canManage).toBe(true);
        });

        it('Supplier ORG_ADMIN: Authorized to manage Relationship Team via fiOrgId on engagement (without ENG_VIEW)', async () => {
            const supplierAdmin = {
                id: 'supplier-admin-user',
                memberships: [{ organizationId: supplierOrgAId, role: Role.ORG_ADMIN, organization: { types: ['SUPPLIER', 'FI'] } }],
            };

            // Supplier ORG_ADMIN CAN manage users on the engagement
            const canManage = await can(supplierAdmin as any, Action.ENG_MANAGE_USERS, { engagementId: engagementAId }, prismaMock);
            expect(canManage).toBe(true);

            // Supplier ORG_ADMIN DOES NOT receive operational ENG_VIEW
            const canViewOperational = await can(supplierAdmin as any, Action.ENG_VIEW, { engagementId: engagementAId }, prismaMock);
            expect(canViewOperational).toBe(false);
        });

        it('RELATIONSHIP_ADMIN: Authorized to manage Team for its explicitly assigned Relationship', async () => {
            const relAdmin = {
                id: 'rel-admin-user',
                memberships: [{ fiEngagementId: engagementAId, role: Role.RELATIONSHIP_ADMIN }],
            };

            const canManage = await can(relAdmin as any, Action.ENG_MANAGE_USERS, { engagementId: engagementAId }, prismaMock);
            expect(canManage).toBe(true);

            // Cannot manage a different relationship
            const canManageOther = await can(relAdmin as any, Action.ENG_MANAGE_USERS, { engagementId: engagementBId }, prismaMock);
            expect(canManageOther).toBe(false);
        });

        it('RELATIONSHIP_USER: Denied Team-management authority', async () => {
            const relUser = {
                id: 'rel-user',
                memberships: [{ fiEngagementId: engagementAId, role: Role.RELATIONSHIP_USER }],
            };

            const canManage = await can(relUser as any, Action.ENG_MANAGE_USERS, { engagementId: engagementAId }, prismaMock);
            expect(canManage).toBe(false);
        });

        it('Plain ORG_MEMBER: Denied Team-management authority', async () => {
            const plainMember = {
                id: 'plain-member',
                memberships: [{ organizationId: supplierOrgAId, role: Role.ORG_MEMBER }],
            };

            const canManage = await can(plainMember as any, Action.ENG_MANAGE_USERS, { engagementId: engagementAId }, prismaMock);
            expect(canManage).toBe(false);
        });
    });
});

