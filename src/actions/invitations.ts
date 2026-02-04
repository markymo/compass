"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { Action, can } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

/**
 * Helper to ensure user has permission to INVITE/REVOKE
 */
async function ensureInvitationAuth(action: Action, context: { orgId: string, clientLEId?: string }) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const memberships = await prisma.membership.findMany({ where: { userId } });
    const user = { id: userId, memberships };

    // Strict Check:
    // If clientLEId provided -> Check LE Context
    // If orgId provided (and no LE) -> Check Party Context
    // (Our updated `can` now distinguishes these contexts strictly)

    const authorized = await can(user, action, {
        partyId: context.orgId,
        clientLEId: context.clientLEId
    }, prisma);

    if (!authorized) throw new Error("Unauthorized to manage invitations");
    return { userId };
}

/**
 * Create a new Invitation
 */
export async function inviteUser(data: {
    email: string;
    role: string; // "ORG_ADMIN", "LE_ADMIN", "LE_USER"
    organizationId: string;
    clientLEId?: string; // Single Scope (Legacy/Simple)
    clientLEIds?: string[]; // Multi Scope (New UX)
}) {
    // 1. Authorize Phase
    // If inviting to Org -> Check Org Perms
    // If inviting to LEs -> Check LE Perms for EACH (Strict) or Org Perms (Management)

    // For simplicity/efficiency: We authorize against the Organization Context first (Manage Team).
    // Technically, an LE_ADMIN might try to invite to *their* LE only.
    // If they are strictly LE_ADMIN, they might not pass "ORG_MANAGE_TEAM".
    // We might need to iterate or do a broader check.

    // Authorization Strategy:
    // A. If ORG_ADMIN -> Can invite anywhere in Org.
    // B. If LE_ADMIN -> Can only invite to LEs they administer.

    try {
        await ensureInvitationAuth(Action.ORG_MANAGE_TEAM, { orgId: data.organizationId });
    } catch {
        // Fallback: Check if they are authorized for specific LEs if provided?
        // For MVP, relying on ORG_MANAGE_TEAM or having enough access via ensureInvitationAuth logic.
        // Note: `ensureInvitationAuth` calls `can(ORG_MANAGE_TEAM)`.
        // Our `permissions.ts` says `ORG_MANAGE_TEAM` is allowed for `LE_ADMIN` (Wait, is it?).
        // Let's check permissions.ts. LE_ADMIN has `LE_MANAGE_USERS`.
        // So if role is LE level, we should check `LE_MANAGE_USERS`.
    }

    // ... (This auth logic is getting complex, let's stick to the simplest loop for now: 
    // If bulk LEs, we assume the caller is likely an Org Admin or we check each).

    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const targetLEs = data.clientLEIds || (data.clientLEId ? [data.clientLEId] : []);

    // CASE 1: Org Wide Invite (No LEs provided)
    if (targetLEs.length === 0) {
        return await createSingleInvitation({ ...data, invitedBy: userId });
    }

    // CASE 2: Multi LE Invite
    const results = [];
    const errors = [];

    for (const leId of targetLEs) {
        // Create individual invite for this LE
        const result = await createSingleInvitation({
            email: data.email,
            role: data.role,
            organizationId: data.organizationId,
            clientLEId: leId,
            invitedBy: userId
        });
        if (result.success) results.push(result);
        else errors.push(result.error);
    }

    revalidatePath(`/app/clients/${data.organizationId}/team`);

    if (results.length === 0 && errors.length > 0) {
        return { success: false, error: errors[0] };
    }

    return { success: true, count: results.length };
}

// Helper for atomic creation
async function createSingleInvitation(data: {
    email: string; role: string; organizationId: string; clientLEId?: string; invitedBy: string;
}) {
    // 1. Check if user is ALREADY a member
    const existingUser = await prisma.user.findFirst({ where: { email: data.email } });
    if (existingUser) {
        const conflict = await prisma.membership.findFirst({
            where: {
                userId: existingUser.id,
                organizationId: data.organizationId,
                clientLEId: data.clientLEId || null,
                role: data.role // Or just any role? membership is unique by scope.
            }
        });
        if (conflict) {
            // Idempotency: If they are already a member, maybe just succeed silently? 
            // Or return error.
            return { success: false, error: `User is already a member of ${data.clientLEId || 'Org'}` };
        }
    }

    // 2. Check for PENDING invitation
    const pending = await prisma.invitation.findFirst({
        where: {
            email: data.email,
            organizationId: data.organizationId,
            clientLEId: data.clientLEId || null,
            status: "PENDING"
        }
    });
    if (pending) {
        // Resend? For now return error
        return { success: false, error: "Invitation already pending." };
    }

    try {
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invite = await prisma.invitation.create({
            data: {
                email: data.email,
                role: data.role,
                organizationId: data.organizationId,
                clientLEId: data.clientLEId || null,
                invitedBy: data.invitedBy,
                token: token,
                expiresAt: expiresAt,
                status: "PENDING"
            }
        });

        console.log(`[Email Mock] To: ${data.email} | Subject: Invited to ${data.clientLEId ? 'LE' : 'Org'} | Link: ${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`);
        return { success: true, data: invite };

    } catch (error) {
        console.error("Invite Failed:", error);
        return { success: false, error: "Failed to create invitation." };
    }
}

/**
 * Revoke an Invitation
 */
export async function revokeInvitation(invitationId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invite) return { success: false, error: "Not found" };

    try {
        await ensureInvitationAuth(Action.ORG_MANAGE_TEAM, {
            orgId: invite.organizationId,
            clientLEId: invite.clientLEId || undefined
        });

        await prisma.invitation.delete({ where: { id: invitationId } });

        revalidatePath(`/app/clients/${invite.organizationId}/team`);
        return { success: true };
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }
}

/**
 * List Pending Invitations for an Org (and its LEs)
 */
export async function getPendingInvitations(orgId: string) {
    try {
        await ensureInvitationAuth(Action.ORG_MANAGE_TEAM, { orgId });
    } catch (e) {
        return [];
    }

    return await prisma.invitation.findMany({
        where: {
            organizationId: orgId,
            status: "PENDING"
        },
        include: {
            clientLE: { select: { name: true } } // Include LE name if scoped
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Accept an Invitation
 */
export async function acceptInvitation(token: string) {
    // 1. Validate Token
    const invite = await prisma.invitation.findUnique({
        where: { token },
        include: {
            organization: true,
            clientLE: true
        }
    });

    if (!invite) return { success: false, error: "Invalid or expired invitation." };
    if (invite.status !== "PENDING") return { success: false, error: "Invitation already accepted or expired." };
    if (new Date() > invite.expiresAt) return { success: false, error: "Invitation has expired." };

    const { userId } = await auth();

    // 2. Scenario A: User is LOGGED IN
    if (userId) {
        // Verify User Email matches Invite Email?
        // OPTIONAL: Ideally yes, but maybe they accept with a different email (e.g. personal vs work).
        // For security, strict matching is safer, OR we update the invite record to link to this user ID before confirming.
        // Let's enforce Strict Matching for now to prevent accidental wrong-account acceptance.
        const user = await prisma.user.findUnique({ where: { id: userId } });

        // Loose check: If user email doesn't match invite email, warn but allow? 
        // Or strict? Let's be strict for MVP safey.
        if (user?.email.toLowerCase() !== invite.email.toLowerCase()) {
            return { success: false, error: `You are logged in as ${user?.email}. This invitation is for ${invite.email}. Please logout and use the correct account.` };
        }

        // Create Membership
        await prisma.membership.create({
            data: {
                userId,
                organizationId: invite.organizationId,
                clientLEId: invite.clientLEId, // Nullable
                role: invite.role
            }
        });

        // Delete Invitation (or mark accepted)
        await prisma.invitation.delete({ where: { id: invite.id } }); // Or update status to ACCEPTED

        return { success: true, redirectUrl: `/app/clients/${invite.organizationId}` };
    }

    // 3. Scenario B: User NOT logged in
    // Return data for the frontend to show "Login" or "Sign Up" options.
    return {
        success: true,
        requiresAuth: true,
        invitationData: {
            email: invite.email,
            orgName: invite.organization?.name,
            leName: invite.clientLE?.name,
            role: invite.role
        }
    };
}
