"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Action, can } from "@/lib/auth/permissions";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { TeamInviteEmail } from "@/components/emails/team-invite-email";
import { SupplierInviteEmail } from "@/components/emails/supplier-invite-email";
import { determineRedirectUrl } from "./accept-invitation";
import { recordActivity, LEActivityType } from "@/lib/le-activity";
import { logActivity } from "./logging";
import { BRAND } from "@/config/brand";
import { getAppBaseUrl } from "@/lib/env";
import { z } from "zod";

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
    // Engagement scope: FI users can invite other FI users
    ENG_RELATIONSHIP_ADMIN: { requiredAction: Action.ENG_MANAGE_USERS, allowedRoles: ["RELATIONSHIP_ADMIN"] },
    ENG_RELATIONSHIP_USER: { requiredAction: Action.ENG_MANAGE_USERS, allowedRoles: ["RELATIONSHIP_USER"] },
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

    // 0. Validate Email Format
    const emailValidation = z.string().trim().email("Please enter a valid email address.").safeParse(payload.email);
    if (!emailValidation.success) {
        return { success: false, error: emailValidation.error.issues[0].message };
    }

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
    const memberships = await prisma.membership.findMany({ where: { userId } });
    const user = { id: userId, memberships };
    const isPlatformAdmin = await can(user, Action.SYSTEM_MANAGE_TENANTS, {}, prisma);

    if (!isPlatformAdmin) {
        const authorised = await can(
            user,
            rule.requiredAction,
            {
                partyId: payload.organizationId,
                clientLEId: payload.clientLEId ??
                    (payload.fiEngagementId && rule.requiredAction === Action.LE_MANAGE_USERS
                        ? (await prisma.fIEngagement.findUnique({ where: { id: payload.fiEngagementId }, select: { clientLEId: true } }))?.clientLEId
                        : undefined),
                engagementId: payload.fiEngagementId,
            },
            prisma
        );

        if (!authorised) {
            return { success: false, error: "Unauthorized: you do not have permission to invite with this role." };
        }

        // Extra gate: only SYSTEM_MANAGE_TENANTS can grant ORG_ADMIN
        if (payload.role === "ORG_ADMIN") {
            return { success: false, error: "Only internal admins can grant the Client Admin (ORG_ADMIN) role." };
        }
    }

    // 3. Duplicate invite check (active pending only: usedAt null, revokedAt null, expiresAt > now)
    const dupeWhere: any = {
        sentToEmail: payload.email,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
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

    if (payload.organizationId || payload.clientLEId || payload.fiEngagementId) {
        existingUser = await prisma.user.findUnique({ where: { email: payload.email } });
        
        if (existingUser) {
            const membershipWhere: any = { userId: existingUser.id };
            if (payload.organizationId) membershipWhere.organizationId = payload.organizationId;
            if (payload.clientLEId) membershipWhere.clientLEId = payload.clientLEId;
            if (payload.fiEngagementId) membershipWhere.fiEngagementId = payload.fiEngagementId;

            isMember = (await prisma.membership.findFirst({ where: membershipWhere })) !== null;
            if (isMember) {
                return { success: false, error: "User is already a member of this scope." };
            }
        }
    }

    // 5. Intelligent Fork: Auto-Add Existing Users
    if (existingUser) {
        let assignedRole = payload.role;
        if (payload.fiEngagementId) {
            if (assignedRole === "ORG_ADMIN") assignedRole = "RELATIONSHIP_ADMIN";
            if (assignedRole === "ORG_MEMBER" || assignedRole === "SUPPLIER_CONTACT") assignedRole = "RELATIONSHIP_USER";
        }

        // Create Membership directly
        await prisma.membership.create({
            data: {
                userId: existingUser.id,
                organizationId: payload.organizationId ?? null,
                clientLEId: payload.clientLEId ?? null,
                fiEngagementId: payload.fiEngagementId ?? null,
                role: assignedRole,
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
        const baseUrl = await getAppBaseUrl();
        let dashboardUrl = `${baseUrl}/app`;
        if (payload.organizationId) dashboardUrl = `${baseUrl}/app/clients/${payload.organizationId}`;
        else if (payload.clientLEId) dashboardUrl = `${baseUrl}/app/le/${payload.clientLEId}`;
        else if (payload.fiEngagementId) {
            const eng = await prisma.fIEngagement.findUnique({ where: { id: payload.fiEngagementId }, select: { fiOrgId: true } });
            dashboardUrl = `${baseUrl}/app/s/${eng?.fiOrgId}`;
        }

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
                from: `${BRAND.name} <noreply@mail.onpro.tech>`,
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
    const baseUrl = await getAppBaseUrl();
    const acceptUrl = `${baseUrl}/invite/${rawToken}`;

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
            from: `${BRAND.name} <noreply@mail.onpro.tech>`,
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

    // Verify requester has manage rights via Action.SYSTEM_MANAGE_TENANTS or Action.ORG_MANAGE_TEAM
    const memberships = await prisma.membership.findMany({ where: { userId: identity.userId } });
    const user = { id: identity.userId, memberships };
    const isPlatformAdmin = await can(user, Action.SYSTEM_MANAGE_TENANTS, {}, prisma);
    if (!isPlatformAdmin) {
        const canOrgManage = await can(user, Action.ORG_MANAGE_TEAM, { partyId: organizationId }, prisma);
        if (!canOrgManage) return [];
    }

    // Fetch org-level invites and LE-level invites for ACTIVE LEs owned by this org
    const leIds = (await prisma.clientLEOwner.findMany({
        where: {
            partyId: organizationId,
            endAt: null,
            clientLE: { isDeleted: false, status: { not: "ARCHIVED" } }
        },
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

    // Gated by explicit LE user management permission
    const memberships = await prisma.membership.findMany({ where: { userId: identity.userId } });
    const user = { id: identity.userId, memberships };
    const hasAccess = await can(user, Action.LE_MANAGE_USERS, { clientLEId }, prisma);
    if (!hasAccess) return [];

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

    // Auth: must have SYSTEM_MANAGE_TENANTS OR be the original inviter / authorized admin via permissions engine
    const memberships = await prisma.membership.findMany({ where: { userId } });
    const user = { id: userId, memberships };
    const isPlatformAdmin = await can(user, Action.SYSTEM_MANAGE_TENANTS, {}, prisma);

    if (!isPlatformAdmin && invite.createdByUserId !== userId) {
        let authorized = false;
        if (invite.organizationId) {
            authorized = await can(user, Action.ORG_MANAGE_TEAM, { partyId: invite.organizationId }, prisma);
        } else if (invite.clientLEId) {
            authorized = await can(user, Action.LE_MANAGE_USERS, { clientLEId: invite.clientLEId }, prisma);
            if (!authorized) {
                const owner = await prisma.clientLEOwner.findFirst({ where: { clientLEId: invite.clientLEId, endAt: null } });
                if (owner) {
                    authorized = await can(user, Action.ORG_MANAGE_TEAM, { partyId: owner.partyId }, prisma);
                }
            }
        } else if (invite.fiEngagementId) {
            authorized = await can(user, Action.ENG_MANAGE_USERS, { engagementId: invite.fiEngagementId }, prisma);
        }
        if (!authorized) return { success: false, error: "Unauthorized" };
    }

    await prisma.invitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() },
    });

    if (invite.organizationId) revalidatePath(`/app/clients/${invite.organizationId}/team`);
    if (invite.clientLEId) {
        const owner = await prisma.clientLEOwner.findFirst({ where: { clientLEId: invite.clientLEId, endAt: null } });
        if (owner) revalidatePath(`/app/clients/${owner.partyId}`);
        revalidatePath(`/app/le/${invite.clientLEId}`);
    }
    if (invite.fiEngagementId) {
        const eng = await prisma.fIEngagement.findUnique({ where: { id: invite.fiEngagementId }, select: { fiOrgId: true } });
        if (eng?.fiOrgId) revalidatePath(`/app/s/${eng.fiOrgId}/team`);
    }
    return { success: true };
}

export async function resendInvitation(invitationId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    const invite = await prisma.invitation.findUnique({ where: { id: invitationId } }) as any;
    if (!invite) return { success: false, error: "Not found" };
    if (invite.usedAt) return { success: false, error: "Cannot resend a used invitation." };
    if (invite.revokedAt) return { success: false, error: "Cannot resend a revoked invitation." };

    const memberships = await prisma.membership.findMany({ where: { userId: identity.userId } });
    const user = { id: identity.userId, memberships };
    const isPlatformAdmin = await can(user, Action.SYSTEM_MANAGE_TENANTS, {}, prisma);

    if (!isPlatformAdmin && invite.createdByUserId !== identity.userId) {
        let authorized = false;
        if (invite.organizationId) {
            authorized = await can(user, Action.ORG_MANAGE_TEAM, { partyId: invite.organizationId }, prisma);
        } else if (invite.clientLEId) {
            authorized = await can(user, Action.LE_MANAGE_USERS, { clientLEId: invite.clientLEId }, prisma);
            if (!authorized) {
                const owner = await prisma.clientLEOwner.findFirst({ where: { clientLEId: invite.clientLEId, endAt: null } });
                if (owner) {
                    authorized = await can(user, Action.ORG_MANAGE_TEAM, { partyId: owner.partyId }, prisma);
                }
            }
        } else if (invite.fiEngagementId) {
            authorized = await can(user, Action.ENG_MANAGE_USERS, { engagementId: invite.fiEngagementId }, prisma);
        }
        if (!authorized) return { success: false, error: "Unauthorized" };
    }

    // Token Rotation for Hashed-Token Security
    const newToken = crypto.randomUUID();
    const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invitation.update({
        where: { id: invitationId },
        data: {
            tokenHash: newTokenHash,
            expiresAt,
        },
    });

    const baseUrl = await getAppBaseUrl();
    const inviteLink = `${baseUrl}/invite/${newToken}`;

    // Actually deliver the new invitation email
    try {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            if (invite.fiEngagementId) {
                const eng = await prisma.fIEngagement.findUnique({
                    where: { id: invite.fiEngagementId },
                    include: { clientLE: true, org: true }
                });
                if (eng) {
                    const emailHtml = await render(SupplierInviteEmail({
                        inviterName: (identity as any).name || identity.email || 'OnPro Administrator',
                        inviterEmail: identity.email || '',
                        orgName: eng.org.name,
                        leName: eng.clientLE.name,
                        role: invite.role,
                        message: "Your invitation has been resent.",
                        inviteLink,
                    }));
                    await resend.emails.send({
                        from: 'OnPro Platform <invites@onpro.tech>',
                        to: invite.sentToEmail,
                        subject: `Invitation resent: ${eng.clientLE.name} Relationship on OnPro`,
                        html: emailHtml,
                    });
                }
            }
        }
    } catch (err) {
        console.error("Failed to resend invitation email", err);
    }

    if (invite.fiEngagementId) {
        const eng = await prisma.fIEngagement.findUnique({ where: { id: invite.fiEngagementId }, select: { fiOrgId: true } });
        if (eng?.fiOrgId) revalidatePath(`/app/s/${eng.fiOrgId}/team`);
    }

    return {
        success: true,
        message: "Invitation resent successfully.",
        newInviteLink: inviteLink
    };
}

export async function generateNewInvitationLink(invitationId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    const invite = await prisma.invitation.findUnique({ where: { id: invitationId } }) as any;
    if (!invite) return { success: false, error: "Not found" };
    if (invite.usedAt) return { success: false, error: "Cannot generate link for a used invitation." };
    if (invite.revokedAt) return { success: false, error: "Cannot generate link for a revoked invitation." };

    const memberships = await prisma.membership.findMany({ where: { userId: identity.userId } });
    const user = { id: identity.userId, memberships };
    const isPlatformAdmin = await can(user, Action.SYSTEM_MANAGE_TENANTS, {}, prisma);

    if (!isPlatformAdmin && invite.createdByUserId !== identity.userId) {
        let authorized = false;
        if (invite.organizationId) {
            authorized = await can(user, Action.ORG_MANAGE_TEAM, { partyId: invite.organizationId }, prisma);
        } else if (invite.clientLEId) {
            authorized = await can(user, Action.LE_MANAGE_USERS, { clientLEId: invite.clientLEId }, prisma);
            if (!authorized) {
                const owner = await prisma.clientLEOwner.findFirst({ where: { clientLEId: invite.clientLEId, endAt: null } });
                if (owner) {
                    authorized = await can(user, Action.ORG_MANAGE_TEAM, { partyId: owner.partyId }, prisma);
                }
            }
        } else if (invite.fiEngagementId) {
            authorized = await can(user, Action.ENG_MANAGE_USERS, { engagementId: invite.fiEngagementId }, prisma);
        }
        if (!authorized) return { success: false, error: "Unauthorized" };
    }

    const newToken = crypto.randomUUID();
    const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invitation.update({
        where: { id: invitationId },
        data: {
            tokenHash: newTokenHash,
            expiresAt,
        }
    });

    const baseUrl = await getAppBaseUrl();
    const inviteLink = `${baseUrl}/invite/${newToken}`;

    if (invite.fiEngagementId) {
        const eng = await prisma.fIEngagement.findUnique({ where: { id: invite.fiEngagementId }, select: { fiOrgId: true } });
        if (eng?.fiOrgId) revalidatePath(`/app/s/${eng.fiOrgId}/team`);
    }

    return {
        success: true,
        inviteLink,
        message: "New invitation link generated. The previous link is now invalid."
    };
}

export async function updateInvitationRole(invitationId: string, role: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    const invite = await prisma.invitation.findUnique({ where: { id: invitationId } }) as any;
    if (!invite) return { success: false, error: "Not found" };
    if (invite.usedAt) return { success: false, error: "Cannot update a used invitation." };

    const memberships = await prisma.membership.findMany({ where: { userId: identity.userId } });
    const user = { id: identity.userId, memberships };
    const isPlatformAdmin = await can(user, Action.SYSTEM_MANAGE_TENANTS, {}, prisma);
    if (!isPlatformAdmin && invite.createdByUserId !== identity.userId) {
        const orgIdToCheck = invite.organizationId ?? null;
        if (orgIdToCheck) {
            const canOrgManage = await can(user, Action.ORG_MANAGE_TEAM, { partyId: orgIdToCheck }, prisma);
            if (!canOrgManage) return { success: false, error: "Unauthorized" };
        } else if (invite.fiEngagementId) {
            const canEngManage = await can(user, Action.ENG_MANAGE_USERS, { engagementId: invite.fiEngagementId }, prisma);
            if (!canEngManage) return { success: false, error: "Unauthorized" };
        } else {
            return { success: false, error: "Unauthorized" };
        }
    }

    await prisma.invitation.update({
        where: { id: invitationId },
        data: { role },
    });

    return { success: true };
}

// ============================================================================
// FR-15: Authenticated Pending-Invitation Discovery & Deliberate Claim
// ============================================================================

export async function getAuthenticatedPendingInvitations() {
    const identity = await getIdentity();
    if (!identity?.email) return [];

    const invitations = await prisma.invitation.findMany({
        where: {
            sentToEmail: { equals: identity.email, mode: "insensitive" },
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        include: {
            organization: { select: { id: true, name: true } },
            clientLE: { select: { id: true, name: true } },
            fiEngagement: {
                select: {
                    id: true,
                    fiOrgId: true,
                    clientLE: { select: { id: true, name: true } },
                    org: { select: { id: true, name: true } },
                }
            }
        },
        orderBy: { createdAt: "desc" },
    });

    return invitations;
}

export async function claimPendingInvitation(invitationId: string) {
    const identity = await getIdentity();
    if (!identity?.userId || !identity?.email) return { success: false, error: "Unauthorized" };

    const invite = await prisma.invitation.findUnique({
        where: { id: invitationId },
        include: {
            fiEngagement: { include: { org: true, clientLE: true } },
            clientLE: true,
            organization: true
        }
    }) as any;

    if (!invite) return { success: false, error: "Invitation not found" };
    if (invite.usedAt) return { success: false, error: "Invitation already accepted" };
    if (invite.revokedAt) return { success: false, error: "Invitation has been revoked" };
    if (new Date(invite.expiresAt) < new Date()) return { success: false, error: "Invitation has expired" };

    if (invite.sentToEmail.toLowerCase() !== identity.email.toLowerCase()) {
        return { success: false, error: "This invitation was sent to a different email address." };
    }

    // Determine target role
    let assignedRole = invite.role;
    if (invite.fiEngagementId) {
        if (assignedRole === "ORG_ADMIN") assignedRole = "RELATIONSHIP_ADMIN";
        if (assignedRole === "ORG_MEMBER" || assignedRole === "SUPPLIER_CONTACT") assignedRole = "RELATIONSHIP_USER";
    }

    // Check if membership already exists
    const existingMem = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            organizationId: invite.organizationId ?? undefined,
            clientLEId: invite.clientLEId ?? undefined,
            fiEngagementId: invite.fiEngagementId ?? undefined,
        }
    });

    if (!existingMem) {
        await prisma.membership.create({
            data: {
                userId: identity.userId,
                organizationId: invite.organizationId ?? null,
                clientLEId: invite.clientLEId ?? null,
                fiEngagementId: invite.fiEngagementId ?? null,
                role: assignedRole,
            }
        });
    }

    if (invite.fiEngagementId) {
        const eng = await prisma.fIEngagement.findUnique({ where: { id: invite.fiEngagementId } });
        if (eng?.status === "INVITED") {
            await prisma.fIEngagement.update({
                where: { id: invite.fiEngagementId },
                data: { status: "CONNECTED" },
            });
        }
        await prisma.engagementActivity.create({
            data: {
                fiEngagementId: invite.fiEngagementId,
                userId: identity.userId,
                type: "TEAM_MEMBER_ADDED",
                details: { email: identity.email, role: assignedRole },
            },
        });
    }

    // Mark invitation used
    await prisma.invitation.update({
        where: { id: invitationId },
        data: {
            usedAt: new Date(),
            acceptedByUserId: identity.userId,
        }
    });

    const redirectUrl = await determineRedirectUrl(invite, prisma);
    return { success: true, redirectUrl };
}
