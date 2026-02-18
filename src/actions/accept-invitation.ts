"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function acceptInvitation(token: string) {
    // 1. Hash the incoming token to lookup
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Find Invitation
    const invite = await prisma.invitation.findUnique({
        where: { tokenHash },
        include: {
            fiEngagement: {
                include: {
                    clientLE: true,
                    org: true
                }
            }
        }
    });

    // 3. Validate
    if (!invite) return { success: false, error: "Invalid invitation link." };

    if (invite.usedAt) return { success: false, error: "This invitation has already been used." };
    if (invite.revokedAt) return { success: false, error: "This invitation has been revoked." };
    if (new Date() > invite.expiresAt) return { success: false, error: "This invitation has expired." };

    // 4. Authenticate User
    const identity = await getIdentity();
    if (!identity?.userId) {
        // Not logged in: Return info to frontend to prompt Login/Register
        return {
            success: true,
            requiresAuth: true,
            invitationData: {
                email: invite.sentToEmail,
                role: invite.role,
                orgName: invite.fiEngagement.org.name, // Supplier Name
                clientLEName: invite.fiEngagement.clientLE.name // Engagement context
            }
        };
    }

    // 5. Verify User Match
    const user = await prisma.user.findUnique({ where: { id: identity.userId } });
    if (!user) return { success: false, error: "User not found." };

    // Strict Email Check
    if (user.email.toLowerCase() !== invite.sentToEmail.toLowerCase()) {
        return {
            success: false,
            error: `Invitation mismatch. You are logged in as ${user.email}, but this invite is for ${invite.sentToEmail}. Please log out and sign in with the correct account.`
        };
    }

    try {
        // 6. Execute Acceptance (Transaction recommended but keeping simple for now)

        // A. Link User to FIEngagement (Membership? Or direct?)
        // The Spec says "User <-> FIEngagement (direct membership)". 
        // Our Schema has `Membership` with `clientLEId` and `organizationId`.
        // BUT for a SUPPLIER USER, they are a member of the SUPPLIER ORGANIZATION (`fiEngagement.fiOrgId`).
        // AND they have access to this engagement.
        // Wait, if they are a Supplier User, they should join the Supplier Org.
        // `invite.fiEngagement.fiOrgId`.

        // Let's check if they are already a member of the Supplier Org.
        const existingMembership = await prisma.membership.findFirst({
            where: {
                userId: user.id,
                organizationId: invite.fiEngagement.fiOrgId,
                clientLEId: null
            }
        });

        if (!existingMembership) {
            await prisma.membership.create({
                data: {
                    userId: user.id,
                    organizationId: invite.fiEngagement.fiOrgId,
                    role: invite.role, // e.g. "Supplier Contact"
                    // We might want to store specific engagement access permissions in `permissions` json?
                    // For "Phase 1 - Engagement Scoped", maybe we just give them Org Membership for now?
                    // Spec: "User ↔ FIEngagement (direct membership)" but schema doesn't have `FIEngagementUser`.
                    // It has `Membership`.
                    // If we give them Membership to the Supplier Org, they are "In".
                    // Then `can` checks if they are in that Org.
                }
            });
        }

        // B. Update Invitation
        await prisma.invitation.update({
            where: { id: invite.id },
            data: {
                usedAt: new Date(),
                acceptedByUserId: user.id
            }
        });

        // C. Update Engagement Status
        if (invite.fiEngagement.status !== "CONNECTED") {
            await prisma.fIEngagement.update({
                where: { id: invite.fiEngagementId },
                data: { status: "CONNECTED" }
            });
        }

        // D. Log
        await prisma.engagementActivity.create({
            data: {
                fiEngagementId: invite.fiEngagementId,
                userId: user.id,
                type: "INVITE_ACCEPTED",
                details: { email: invite.sentToEmail }
            }
        });

        return { success: true, redirectUrl: `/app/fi/${invite.fiEngagement.fiOrgId}` }; // Redirect to Supplier Dashboard?

    } catch (e) {
        console.error("Accept Invitation Failed:", e);
        return { success: false, error: "Failed to accept invitation." };
    }
}
