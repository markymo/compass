"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { Action, can } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { SupplierInviteEmail } from "@/components/emails/supplier-invite-email";
import { SupplierAccessGrantedEmail } from "@/components/emails/supplier-access-granted-email";
import crypto from "crypto";
import { getAppBaseUrl } from "@/lib/env";

// Removed top-level initialization to prevent errors during module import if API key is missing.

/**
 * Invite a supplier to collaborate on an existing engagement.
 * Triggers status change to INVITED.
 */
export async function inviteSupplier(
    fiEngagementId: string,
    email: string,
    role: string = "RELATIONSHIP_ADMIN",
    message?: string
) {
    // 1. Authentication & Context
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    // 2. Fetch Engagement to get Context (ClientLE, Org)
    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: fiEngagementId },
        include: {
            clientLE: true,
            org: true
        }
    });

    if (!engagement) return { success: false, error: "Engagement not found" };

    // 3. Authorization (Must have ENG_MANAGE_USERS or LE_MANAGE_USERS)
    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId }
    });
    const user = { id: identity.userId, memberships };

    const isAuthorized = await can(user, Action.ENG_MANAGE_USERS, { engagementId: fiEngagementId }, prisma) ||
                         await can(user, Action.LE_MANAGE_USERS, { clientLEId: engagement.clientLEId }, prisma);

    if (!isAuthorized) {
        return { success: false, error: "You do not have permission to invite suppliers for this entity." };
    }

    // Role validation: Only RELATIONSHIP_ADMIN and RELATIONSHIP_USER are permitted
    const ALLOWED_RELATIONSHIP_ROLES = ["RELATIONSHIP_ADMIN", "RELATIONSHIP_USER"];
    if (!ALLOWED_RELATIONSHIP_ROLES.includes(role)) {
        return {
            success: false,
            error: `Invalid role "${role}". Only RELATIONSHIP_ADMIN and RELATIONSHIP_USER are permitted for Relationship Team members.`
        };
    }

    // 4. Existing User Fork: Auto-Add Immediate Membership
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        const isMember = await prisma.membership.findFirst({
            where: { userId: existingUser.id, fiEngagementId }
        });
        if (isMember) {
            return { success: false, error: "User is already a member of this relationship." };
        }

        await prisma.membership.create({
            data: {
                userId: existingUser.id,
                fiEngagementId,
                role,
            }
        });

        if (engagement.status === "INVITED") {
            await prisma.fIEngagement.update({
                where: { id: fiEngagementId },
                data: { status: "CONNECTED" },
            });
        }

        await prisma.engagementActivity.create({
            data: {
                fiEngagementId,
                userId: existingUser.id,
                type: "TEAM_MEMBER_ADDED",
                details: { email, role },
            },
        });

        // Communication for Existing User: Access Granted Notification
        try {
            const baseUrl = await getAppBaseUrl();
            const directWorkspaceUrl = `${baseUrl}/app/s/${engagement.fiOrgId}`;
            const emailHtml = await render(SupplierAccessGrantedEmail({
                inviterName: (identity as any).name || identity.email || 'OnPro Administrator',
                inviterEmail: identity.email || 'noreply@onpro.tech',
                orgName: engagement.org.name,
                leName: engagement.clientLE.name,
                role,
                workspaceUrl: directWorkspaceUrl
            }));

            const resendApiKey = process.env.RESEND_API_KEY;
            if (resendApiKey) {
                const resend = new Resend(resendApiKey);
                await resend.emails.send({
                    from: 'OnPro Platform <invites@onpro.tech>',
                    to: email,
                    subject: `Access granted: ${engagement.clientLE.name} Relationship on OnPro`,
                    html: emailHtml
                });
            }
        } catch (mailErr) {
            console.error("Failed to send access notification email", mailErr);
        }

        revalidatePath(`/app/s/${engagement.fiOrgId}/team`);
        revalidatePath(`/app/le/${engagement.clientLEId}/relationships`);
        return { success: true, autoAdded: true, role };
    }

    // 5. Check for Pending Invitation (for unknown email)
    const pending = await prisma.invitation.findFirst({
        where: {
            sentToEmail: email,
            fiEngagementId,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() }
        }
    });

    if (pending) {
        return { success: false, error: "Active invitation already exists for this email." };
    }

    try {
        // 6. Create Invitation with Hashed Token
        const token = crypto.randomUUID(); // The secret sent to the user
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); // The stored proof

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 Day Expiry

        const invite = await prisma.invitation.create({
            data: {
                sentToEmail: email,
                role,
                tokenHash,
                expiresAt,
                createdByUserId: identity.userId,
                fiEngagementId
            }
        });

        // 7. Send Email via Resend
        const baseUrl = await getAppBaseUrl();
        const inviteLink = `${baseUrl}/invite/${token}`;

        const emailHtml = await render(SupplierInviteEmail({
            inviterName: (identity as any).name || identity.email || 'OnPro Administrator',
            inviterEmail: identity.email || 'noreply@onpro.tech',
            orgName: engagement.org.name,
            leName: engagement.clientLE.name,
            role: role,
            message: message,
            inviteLink: inviteLink
        }));

        let emailSent = false;
        let emailDeliveryError: string | null = null;

        try {
            if (process.env.RESEND_API_KEY) {
                const resend = new Resend(process.env.RESEND_API_KEY);
                const sendRes = await resend.emails.send({
                    from: 'OnPro Platform <invites@onpro.tech>',
                    to: email,
                    subject: `Invitation: join ${engagement.org.name} for ${engagement.clientLE.name} Relationship on OnPro`,
                    html: emailHtml
                });
                if (sendRes?.error) {
                    emailDeliveryError = sendRes.error.message || "Failed to send email";
                } else {
                    emailSent = true;
                }
            } else {
                emailDeliveryError = "Email delivery service not configured";
            }
        } catch (mailErr: any) {
            console.warn("[Resend] Failed to send supplier invite email:", mailErr);
            emailDeliveryError = mailErr?.message || "Failed to send email";
        }

        // 7. Update Engagement Status
        if (engagement.status !== "CONNECTED" && engagement.status !== "INVITED") {
            await prisma.fIEngagement.update({
                where: { id: fiEngagementId },
                data: { status: "INVITED" }
            });
        }

        // 8. Audit Log
        await prisma.engagementActivity.create({
            data: {
                fiEngagementId,
                userId: identity.userId,
                type: "INVITE_SENT",
                details: { email, role, message }
            }
        });

        revalidatePath(`/app/le/${engagement.clientLEId}/relationships`);

        // Return Token/ID for UI display (e.g. Copy Link)
        return {
            success: true,
            token,
            inviteId: invite.id,
            emailSent,
            emailDeliveryError
        };

    } catch (e) {
        console.error("Failed to invite supplier:", e);
        return { success: false, error: "Failed to create invitation." };
    }
}
