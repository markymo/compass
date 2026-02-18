"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { Action, can } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { SupplierInviteEmail } from "@/components/emails/supplier-invite-email";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Invite a supplier to collaborate on an existing engagement.
 * Triggers status change to INVITED.
 */
export async function inviteSupplier(
    fiEngagementId: string,
    email: string,
    role: string = "Supplier Contact",
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

    // 3. Authorization (Must be LE Admin for the Client LE)
    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId }
    });
    const user = { id: identity.userId, memberships };

    // Strict Context Check: Is user admin for this Client LE?
    const isAuthorized = await can(user, Action.LE_MANAGE_USERS, { clientLEId: engagement.clientLEId }, prisma);

    if (!isAuthorized) {
        return { success: false, error: "You do not have permission to invite suppliers for this entity." };
    }

    // 4. Check for Pending Invitation
    // Valid if: sent to same email, same engagement, not used, not revoked, not expired
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
        // 5. Create Invitation with Hashed Token
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

        // 6. Send Email via Resend
        // NOTE: We send the raw `token` (the key), not the hash.
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

        const emailHtml = await render(SupplierInviteEmail({
            inviterName: 'Compass User', // TODO: Get real name
            inviterEmail: identity.email || 'noreply@compass.com',
            orgName: "Compass Workspace",
            leName: engagement.clientLE.name,
            role: role,
            message: message,
            inviteLink: inviteLink
        }));

        await resend.emails.send({
            from: 'Compass <onboarding@resend.dev>', // Use resend.dev for testing unless verified domain
            to: email,
            subject: `Invitation to collaborate on ${engagement.clientLE.name}`,
            html: emailHtml
        });

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
        // SECURITY NOTE: We return the token here so the UI can display a "Copy Link" if needed,
        // but typically we should rely on the email.
        return { success: true, token, inviteId: invite.id };

    } catch (e) {
        console.error("Failed to invite supplier:", e);
        return { success: false, error: "Failed to create invitation." };
    }
}
