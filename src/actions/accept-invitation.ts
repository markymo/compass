"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// acceptInvitation — Unified Accept Action
// ============================================================================

export async function acceptInvitation(rawToken: string) {
    // 1. Hash the incoming token for lookup
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 2. Fetch invitation with all scope relations
    // @ts-ignore: Prisma cache lag — new fields on Invitation model
    const invite = await prisma.invitation.findUnique({
        where: { tokenHash },
        // @ts-ignore
        include: {
            organization: { select: { id: true, name: true } },
            clientLE: { select: { id: true, name: true } },
            fiEngagement: {
                include: {
                    org: { select: { id: true, name: true } },
                    clientLE: { select: { id: true, name: true } },
                },
            },
        },
    }) as any;  // cast to any — type is correct at runtime post-migration

    // 3. Validate token
    if (!invite) return { success: false, error: "Invalid or expired invitation link." };
    if (invite.usedAt) return { success: false, error: "This invitation has already been accepted." };
    if (invite.revokedAt) return { success: false, error: "This invitation has been revoked." };
    if (new Date() > invite.expiresAt) return { success: false, error: "This invitation has expired." };

    // 4. Determine scope
    const scopeType = invite.organizationId
        ? "ORG"
        : invite.clientLEId
            ? "LE"
            : invite.fiEngagementId
                ? "ENG"
                : null;

    if (!scopeType) return { success: false, error: "Invitation has no valid scope. Please contact support." };

    // 5. Auth check — must be logged in with matching email
    const identity = await getIdentity();
    if (!identity?.userId) {
        // Return invitation preview so the UI can prompt login/register
        return {
            success: true,
            requiresAuth: true,
            invitationData: {
                email: invite.sentToEmail,
                role: invite.role,
                orgName: invite.organization?.name ?? invite.fiEngagement?.org.name ?? "",
                clientLEName: invite.clientLE?.name ?? invite.fiEngagement?.clientLE.name ?? "",
                scopeType,
            },
        };
    }

    const user = await prisma.user.findUnique({ where: { id: identity.userId } });
    if (!user) return { success: false, error: "User account not found." };

    // Strict email match
    if (user.email.toLowerCase() !== invite.sentToEmail.toLowerCase()) {
        return {
            success: false,
            error: `This invitation is for ${invite.sentToEmail}. You are signed in as ${user.email}. Please sign in with the correct account.`,
        };
    }

    try {
        // 6. Create the correct Membership based on scope
        if (scopeType === "ORG" && invite.organizationId) {
            // Org-scoped: create org membership (idempotent)
            const existing = await prisma.membership.findFirst({
                where: { userId: user.id, organizationId: invite.organizationId, clientLEId: null },
            });
            if (!existing) {
                await prisma.membership.create({
                    data: {
                        userId: user.id,
                        organizationId: invite.organizationId,
                        clientLEId: null,
                        role: invite.role,
                    },
                });
            }

        } else if (scopeType === "LE" && invite.clientLEId) {
            // LE-scoped: create LE membership (idempotent)
            const existing = await prisma.membership.findFirst({
                where: { userId: user.id, clientLEId: invite.clientLEId, organizationId: null },
            });
            if (!existing) {
                await prisma.membership.create({
                    data: {
                        userId: user.id,
                        organizationId: null,
                        clientLEId: invite.clientLEId,
                        role: invite.role,
                    },
                });
            }

        } else if (scopeType === "ENG" && invite.fiEngagementId && invite.fiEngagement) {
            // Engagement-scoped: join the engagement directly (idempotent)
            const existing = await prisma.membership.findFirst({
                where: { userId: user.id, fiEngagementId: invite.fiEngagementId, organizationId: null, clientLEId: null },
            });
            
            // Map legacy roles if they were sent as ORG_* by mistake
            let assignedRole = invite.role;
            if (assignedRole === "ORG_ADMIN" || assignedRole === "SUPPLIER_ADMIN") assignedRole = "RELATIONSHIP_ADMIN";
            if (assignedRole === "ORG_MEMBER" || assignedRole === "SUPPLIER_CONTACT") assignedRole = "RELATIONSHIP_USER";

            if (!existing) {
                await prisma.membership.create({
                    data: {
                        userId: user.id,
                        organizationId: null,
                        clientLEId: null,
                        fiEngagementId: invite.fiEngagementId,
                        role: assignedRole,
                    },
                });
            }

            // Update engagement status to CONNECTED if still in INVITED
            if (invite.fiEngagement.status === "INVITED") {
                await prisma.fIEngagement.update({
                    where: { id: invite.fiEngagementId },
                    data: { status: "CONNECTED" },
                });
            }

            // Log engagement activity
            await prisma.engagementActivity.create({
                data: {
                    fiEngagementId: invite.fiEngagementId,
                    userId: user.id,
                    type: "INVITE_ACCEPTED",
                    details: { email: invite.sentToEmail, role: invite.role },
                },
            });
        }

        // --- UsageLog (Unified platform-wide analytics) ---
        const { logActivityDirect } = await import("./logging");
        logActivityDirect(user.id, "INVITATION_ACCEPTED", `/invite`, {
            email: invite.sentToEmail,
            role: invite.role,
            scope: scopeType,
            organizationId: invite.organizationId,
            clientLEId: invite.clientLEId,
            fiEngagementId: invite.fiEngagementId,
        });

        // 7. Mark invitation as used (idempotent guard at top handles double-clicks)
        await prisma.invitation.update({
            where: { id: invite.id },
            data: { usedAt: new Date(), acceptedByUserId: user.id },
        });

        // 8. Determine redirect target
        let redirectUrl = "/app";
        if (invite.organization) redirectUrl = `/app/clients/${invite.organization.id}`;
        else if (invite.clientLE) {
            const owner = await prisma.clientLEOwner.findFirst({
                where: { clientLEId: invite.clientLE.id, endAt: null },
            });
            if (owner) redirectUrl = `/app/clients/${owner.partyId}`;
            else redirectUrl = `/app/le/${invite.clientLE.id}`;
        } else if (invite.fiEngagement) {
            redirectUrl = `/app/s/${invite.fiEngagement.fiOrgId}`;
        }

        // Revalidate
        if (invite.organizationId) revalidatePath(`/app/clients/${invite.organizationId}/team`);

        return { success: true, redirectUrl };

    } catch (e) {
        console.error("[acceptInvitation] Error:", e);
        return { success: false, error: "An unexpected error occurred. Please try again." };
    }
}
