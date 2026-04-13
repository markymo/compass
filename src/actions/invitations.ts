"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Action, can } from "@/lib/auth/permissions";
import { isSystemAdmin } from "@/actions/security";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { TeamInviteEmail } from "@/components/emails/team-invite-email";
import { recordActivity, LEActivityType } from "@/lib/le-activity";
import { logActivity } from "./logging";
import { BRAND } from "@/config/brand";

// ============================================================================
// Types
// ============================================================================

export type InvitePayload = {
    email: string;
    role: string;
    // Exactly ONE scope must be set:
    organizationId?: string;
    clientLEId?: string;
    fiEngagementId?: string;
};

// ============================================================================
// Delegation Rules
// Maps scope + role to the required Action the inviter must hold.
// ============================================================================

const DELEGATION_TABLE: Record<string, { requiredAction: Action; allowedRoles: string[] }> = {
    // ORG scope: only internal admins can grant ORG_ADMIN
    ORG_ORG_ADMIN: { requiredAction: Action.ORG_MANAGE_TEAM, allowedRoles: ["ORG_ADMIN"] },
    // ORG scope: org admins can grant ORG_MEMBER
    ORG_ORG_MEMBER: { requiredAction: Action.ORG_MANAGE_TEAM, allowedRoles: ["ORG_MEMBER"] },

    // LE scope: org admins can grant LE_ADMIN
    LE_LE_ADMIN: { requiredAction: Action.LE_MANAGE_USERS, allowedRoles: ["LE_ADMIN"] },
    // LE scope: LE admins can grant LE_USER
    LE_LE_USER: { requiredAction: Action.LE_MANAGE_USERS, allowedRoles: ["LE_USER"] },

    // Engagement scope: LE admins can invite Supplier contacts
    ENG_SUPPLIER_CONTACT: { requiredAction: Action.LE_MANAGE_USERS, allowedRoles: ["SUPPLIER_CONTACT"] },
};

// Validate scope and determine delegation key
function getScopeType(payload: InvitePayload): "ORG" | "LE" | "ENG" | null {
    const scopes = [payload.organizationId, payload.clientLEId, payload.fiEngagementId].filter(Boolean);
    if (scopes.length !== 1) return null;
    if (payload.organizationId) return "ORG";
    if (payload.clientLEId) return "LE";
    if (payload.fiEngagementId) return "ENG";
    return null;
}

// ============================================================================
// inviteUser — Unified Invite Action
// ============================================================================

export async function inviteUser(payload: InvitePayload) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    // 1. Validate exactly one scope
    const scopeType = getScopeType(payload);
    if (!scopeType) {
        return { success: false, error: "Invalid scope: exactly one of organizationId, clientLEId, or fiEngagementId must be set." };
    }

    const delegationKey = `${scopeType}_${payload.role}`;
    const rule = DELEGATION_TABLE[delegationKey];

    if (!rule) {
        return { success: false, error: `Invalid delegation: cannot grant role '${payload.role}' in '${scopeType}' scope.` };
    }

    // 2. Authorise the inviter
    // System admins can always invite
    const sysAdmin = await isSystemAdmin();

    if (!sysAdmin) {
        const memberships = await prisma.membership.findMany({ where: { userId } });
        const user = { id: userId, memberships };

        const authorised = await can(
            user,
            rule.requiredAction,
            {
                partyId: payload.organizationId,
                clientLEId: payload.clientLEId ??
                    (payload.fiEngagementId
                        ? (await prisma.fIEngagement.findUnique({ where: { id: payload.fiEngagementId }, select: { clientLEId: true } }))?.clientLEId
                        : undefined),
            },
            prisma
        );

        if (!authorised) {
            return { success: false, error: "Unauthorized: you do not have permission to invite with this role." };
        }

        // Extra gate: only SYSTEM_ADMIN can grant ORG_ADMIN
        if (payload.role === "ORG_ADMIN" && !sysAdmin) {
            return { success: false, error: "Only internal admins can grant the Client Admin (ORG_ADMIN) role." };
        }
    }

    // 3. Duplicate invite check
    const dupeWhere: any = {
        sentToEmail: payload.email,
        usedAt: null,
        revokedAt: null,
        // @ts-ignore: Prisma cache lag — new fields
        ...(payload.organizationId ? { organizationId: payload.organizationId } : {}),
        // @ts-ignore
        ...(payload.clientLEId ? { clientLEId: payload.clientLEId } : {}),
        ...(payload.fiEngagementId ? { fiEngagementId: payload.fiEngagementId } : {}),
    };

    const existing = await prisma.invitation.findFirst({ where: dupeWhere });
    if (existing) {
        return { success: false, error: "A pending invitation for this user and scope already exists." };
    }

    // 4. Already a member check & Auto-Add Logic
    let existingUser = null;
    let isMember = false;
    let targetOrgId = payload.organizationId;
    let targetLEId = payload.clientLEId;

    if (payload.fiEngagementId) {
        const eng = await prisma.fIEngagement.findUnique({ where: { id: payload.fiEngagementId } });
        if (eng) targetOrgId = eng.fiOrgId;
    }

    if (targetOrgId || targetLEId || payload.fiEngagementId) {
        existingUser = await prisma.user.findUnique({ where: { email: payload.email } });
        
        if (existingUser) {
            const membershipWhere: any = { userId: existingUser.id };
            if (targetOrgId) membershipWhere.organizationId = targetOrgId;
            if (targetLEId) membershipWhere.clientLEId = targetLEId;

            isMember = (await prisma.membership.findFirst({ where: membershipWhere })) !== null;
            if (isMember) {
                return { success: false, error: "User is already a member of this organisation." };
            }
        }
    }

    // 5. Intelligent Fork: Auto-Add Existing Users
    if (existingUser) {
        // Create Membership directly
        await prisma.membership.create({
            data: {
                userId: existingUser.id,
                organizationId: targetOrgId ?? null,
                clientLEId: targetLEId ?? null,
                role: payload.role,
            }
        });

        if (payload.fiEngagementId) {
            const eng = await prisma.fIEngagement.findUnique({ where: { id: payload.fiEngagementId } });
            if (eng?.status === "INVITED") {
                await prisma.fIEngagement.update({
                    where: { id: payload.fiEngagementId },
                    data: { status: "CONNECTED" },
                });
            }
            await prisma.engagementActivity.create({
                data: {
                    fiEngagementId: payload.fiEngagementId,
                    userId: existingUser.id,
                    type: "TEAM_MEMBER_ADDED",
                    details: { email: payload.email, role: payload.role },
                },
            });
        }

        // Determine Redirect URL for the email
        let dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/app`;
        if (targetOrgId) dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/app/clients/${targetOrgId}`;
        else if (targetLEId) dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/app/le/${targetLEId}`;
        else if (payload.fiEngagementId) dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/app/s/${targetOrgId}`;

        try {
            // Resolve scope label
            let scopeLabel = BRAND.name;
            if (payload.organizationId) {
                const org = await prisma.organization.findUnique({ where: { id: payload.organizationId } });
                if (org) scopeLabel = org.name;
            } else if (payload.clientLEId) {
                const le = await prisma.clientLE.findUnique({ where: { id: payload.clientLEId } });
                if (le) scopeLabel = le.name;
            } else if (payload.fiEngagementId) {
                const eng = await prisma.fIEngagement.findUnique({ where: { id: payload.fiEngagementId }, include: { clientLE: true } });
                if (eng?.clientLE) scopeLabel = eng.clientLE.name;
            }

            const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
            const inviterName = inviter?.name || inviter?.email || "A team member";

            const resend = new Resend(process.env.RESEND_API_KEY);
            // Re-using TeamInviteEmail for now but telling them they've been added.
            // Ideally we'd have a TeamAddedEmail template, but we can parameterize it if needed.
            // Or just use the existing one, the URL goes to their dashboard!
            const html = await render(TeamInviteEmail({ 
                inviterName, 
                scopeLabel, 
                role: payload.role, 
                inviteLink: dashboardUrl, // Direct to dashboard instead of /invite token
                recipientEmail: payload.email 
            }));

            await resend.emails.send({
                from: `${BRAND.name} <noreply@app.coparity.tech>`,
                to: payload.email,
                subject: `You have been granted access to ${scopeLabel}`,
                html,
            });
        } catch (emailErr) {
            console.error("[Resend] Failed to send added notification email:", emailErr);
        }

        // Logging
        if (payload.clientLEId) {
            recordActivity(payload.clientLEId, userId, LEActivityType.TEAM_MEMBER_INVITED, {
                invitedEmail: payload.email,
                role: payload.role,
                note: "Auto-Added Existing User"
            });
        }

        logActivity("USER_ADDED_DIRECTLY", `/invite`, {
            email: payload.email,
            role: payload.role,
            scope: getScopeType(payload),
        });

        if (payload.organizationId) revalidatePath(`/app/clients/${payload.organizationId}/team`);
        if (payload.clientLEId) {
            const le = await prisma.clientLE.findUnique({ where: { id: payload.clientLEId }, include: { owners: true } });
            if (le?.owners[0]) revalidatePath(`/app/clients/${le.owners[0].partyId}/team`);
            revalidatePath(`/app/le/${payload.clientLEId}`);
        }

        return { success: true, message: `User ${payload.email} was found and instantly granted access.` };
    }

    // 5. Generate token — store hash only (security)
    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 6. Create invitation
    // @ts-ignore: Prisma cache lag — organizationId, clientLEId are new fields not in stale client type
    await (prisma.invitation.create as any)({
        data: {
            sentToEmail: payload.email,
            role: payload.role,
            tokenHash,
            expiresAt,
            createdByUserId: userId,
            organizationId: payload.organizationId ?? null,
            clientLEId: payload.clientLEId ?? null,
            fiEngagementId: payload.fiEngagementId ?? null,
        },
    });

    // 7. Send invitation email via Resend
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const acceptUrl = `${baseUrl.replace(/\/$/, '')}/invite/${rawToken}`;

    try {
        // Resolve human-readable scope label and inviter name for the email
        let scopeLabel = BRAND.name;
        if (payload.organizationId) {
            const org = await prisma.organization.findUnique({ where: { id: payload.organizationId }, select: { name: true } });
            if (org) scopeLabel = org.name;
        } else if (payload.clientLEId) {
            const le = await prisma.clientLE.findUnique({ where: { id: payload.clientLEId }, select: { name: true } });
            if (le) scopeLabel = le.name;
        } else if (payload.fiEngagementId) {
            const eng = await prisma.fIEngagement.findUnique({ where: { id: payload.fiEngagementId }, include: { clientLE: { select: { name: true } } } });
            if (eng) scopeLabel = eng.clientLE.name;
        }

        const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        const inviterName = inviter?.name || inviter?.email || "A team member";

        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = await render(TeamInviteEmail({ inviterName, scopeLabel, role: payload.role, inviteLink: acceptUrl, recipientEmail: payload.email }));

        await resend.emails.send({
            from: `${BRAND.name} <noreply@app.coparity.tech>`,
            to: payload.email,
            subject: `You've been invited to join ${scopeLabel}`,
            html,
        });
    } catch (emailErr) {
        // Don't fail the whole invite if email delivery fails — log and continue.
        console.error("[Resend] Failed to send invitation email:", emailErr);
    }

    // Fire LEActivity for LE-scoped invites (fire-and-forget)
    if (payload.clientLEId) {
        recordActivity(payload.clientLEId, userId, LEActivityType.TEAM_MEMBER_INVITED, {
            invitedEmail: payload.email,
            role: payload.role,
        });
    }

    // UsageLog (platform-wide analytics)
    logActivity("INVITATION_SENT", `/invite`, {
        invitedEmail: payload.email,
        role: payload.role,
        scope: scopeType,
    });

    // Revalidate relevant pages
    if (payload.organizationId) revalidatePath(`/app/clients/${payload.organizationId}/team`);
    if (payload.clientLEId) {
        const le = await prisma.clientLE.findUnique({
            where: { id: payload.clientLEId },
            select: { owners: { where: { endAt: null }, select: { partyId: true }, take: 1 } }
        });
        if (le?.owners[0]) revalidatePath(`/app/clients/${le.owners[0].partyId}/team`);
    }

    return { success: true, message: `Invitation sent to ${payload.email}.` };
}

// ============================================================================
// getPendingInvitations — for Team Management UI
// ============================================================================

export async function getPendingInvitations(organizationId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return [];

    // Verify requester has manage rights
    const sysAdmin = await isSystemAdmin();
    if (!sysAdmin) {
        const membership = await prisma.membership.findFirst({
            where: { userId: identity.userId, organizationId, role: "ORG_ADMIN" },
        });
        if (!membership) return [];
    }

    // Fetch org-level invites and LE-level invites for LEs owned by this org
    const leIds = (await prisma.clientLEOwner.findMany({
        where: { partyId: organizationId, endAt: null },
        select: { clientLEId: true },
    })).map((o: any) => o.clientLEId);

    // @ts-ignore: Prisma cache lag — organizationId, clientLEId, clientLE include are new fields
    return await (prisma.invitation.findMany as any)({
        where: {
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            OR: [
                { organizationId },
                { clientLEId: { in: leIds } },
            ],
        },
        include: {
            clientLE: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}

export async function getLEPendingInvitations(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return [];

    // Simple auth check similar to others
    const sysAdmin = await isSystemAdmin();
    if (!sysAdmin) {
        const hasAccess = await can(
            { id: identity.userId, memberships: await prisma.membership.findMany({ where: { userId: identity.userId } }) },
            Action.LE_MANAGE_USERS,
            { clientLEId },
            prisma
        );
        if (!hasAccess) return [];
    }

    // @ts-ignore
    return await (prisma.invitation.findMany as any)({
        where: {
            clientLEId,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
    });
}

// ============================================================================
// revokeInvitation
// ============================================================================

export async function revokeInvitation(invitationId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    // @ts-ignore: Prisma cache lag — organizationId is a new field not in stale client type
    const invite = await prisma.invitation.findUnique({ where: { id: invitationId } }) as any;
    if (!invite) return { success: false, error: "Not found" };
    if (invite.usedAt) return { success: false, error: "Cannot revoke a used invitation." };

    // Auth: must be system admin OR the original inviter
    const sysAdmin = await isSystemAdmin();
    if (!sysAdmin && invite.createdByUserId !== userId) {
        // Also allow ORG_ADMIN of the relevant org
        const orgIdToCheck = invite.organizationId ?? null;
        if (orgIdToCheck) {
            const m = await prisma.membership.findFirst({ where: { userId, organizationId: orgIdToCheck, role: "ORG_ADMIN" } });
            if (!m) return { success: false, error: "Unauthorized" };
        } else {
            return { success: false, error: "Unauthorized" };
        }
    }

    await prisma.invitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() },
    });

    if (invite.organizationId) revalidatePath(`/app/clients/${invite.organizationId}/team`);
    return { success: true };
}


