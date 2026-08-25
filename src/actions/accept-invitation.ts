"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// Shared Helpers
// ============================================================================

export async function determineRedirectUrl(invite: any, client: any = prisma): Promise<string> {
    let redirectUrl = "/app";
    if (invite.organization) {
        redirectUrl = `/app/clients/${invite.organization.id}`;
    } else if (invite.clientLE) {
        const owner = await client.clientLEOwner.findFirst({
            where: { clientLEId: invite.clientLE.id, endAt: null },
        });
        if (owner) redirectUrl = `/app/clients/${owner.partyId}`;
        else redirectUrl = `/app/le/${invite.clientLE.id}`;
    } else if (invite.fiEngagement) {
        redirectUrl = `/app/s/${invite.fiEngagement.fiOrgId}`;
    }
    return redirectUrl;
}

export async function reconcileQuestionAssignments(sentToEmail: string, scope: { clientLEId?: string | null; fiEngagementId?: string | null; organizationId?: string | null }, userId: string, tx: any) {
    if (!sentToEmail) return;

    let scopeWhere: any = { assignedEmail: sentToEmail, assignedToUserId: null };
    if (scope.clientLEId) {
        scopeWhere.questionnaire = {
            OR: [
                { fiEngagement: { clientLEId: scope.clientLEId } },
                { engagements: { some: { clientLEId: scope.clientLEId } } },
                { clientLEs: { some: { id: scope.clientLEId } } }
            ]
        };
    } else if (scope.fiEngagementId) {
        scopeWhere.questionnaire = {
            OR: [
                { fiEngagementId: scope.fiEngagementId },
                { engagements: { some: { id: scope.fiEngagementId } } }
            ]
        };
    } else if (scope.organizationId) {
        scopeWhere.questionnaire = {
            OR: [
                { fiOrgId: scope.organizationId },
                { fiEngagement: { fiOrgId: scope.organizationId } }
            ]
        };
    }
    await tx.question.updateMany({
        where: scopeWhere,
        data: { assignedToUserId: userId }
    }).catch((err: any) => console.error("Failed to reconcile question assignments for invitee:", err));
}

// ============================================================================
// registerAndAcceptInvitation — Atomic Registration & Invitation Consumption
// ============================================================================

export async function registerAndAcceptInvitation(payload: {
    token: string;
    password: string;
    name?: string;
}) {
    const { token, password, name } = payload;

    if (!token || typeof token !== "string") {
        return { success: false, error: "Invalid invitation token." };
    }

    if (!password || password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long." };
    }

    // 1. Hash incoming token for lookup
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // 2. Fetch invitation with all scope relations
    // @ts-ignore
    const invite = await prisma.invitation.findUnique({
        where: { tokenHash },
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
    }) as any;

    // 3. Validate invitation
    if (!invite) return { success: false, error: "Invalid or expired invitation link." };
    if (invite.usedAt) return { success: false, error: "This invitation has already been accepted." };
    if (invite.revokedAt) return { success: false, error: "This invitation has been revoked." };
    if (new Date() > invite.expiresAt) return { success: false, error: "This invitation has expired." };

    const scopeType = invite.organizationId
        ? "ORG"
        : invite.clientLEId
            ? "LE"
            : invite.fiEngagementId
                ? "ENG"
                : null;

    if (!scopeType) return { success: false, error: "Invitation has no valid scope. Please contact support." };

    const targetEmail = invite.sentToEmail.toLowerCase();

    // 4. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (existingUser) {
        return {
            success: false,
            error: `An account with ${invite.sentToEmail} already exists. Please sign in to accept your invitation.`,
        };
    }

    // 5. Derive name & Hash password
    const derivedName = name?.trim() || invite.sentToEmail.split('@')[0].split('.').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // 6. Execute atomic Prisma transaction
        const newUser = await prisma.$transaction(async (tx: any) => {
            // Re-verify invitation within transaction
            const freshInvite = await tx.invitation.findUnique({ where: { id: invite.id } });
            if (!freshInvite || freshInvite.usedAt || freshInvite.revokedAt || new Date() > freshInvite.expiresAt) {
                throw new Error("INVITATION_ALREADY_USED_OR_INVALID");
            }

            // Re-verify user within transaction
            const userCheck = await tx.user.findUnique({ where: { email: targetEmail } });
            if (userCheck) {
                throw new Error("USER_ALREADY_EXISTS");
            }

            // Create User
            const createdUser = await tx.user.create({
                data: {
                    name: derivedName,
                    email: targetEmail,
                    password: hashedPassword,
                    emailVerified: new Date(),
                },
            });

            // Create Membership
            if (scopeType === "ORG" && invite.organizationId) {
                await tx.membership.create({
                    data: {
                        userId: createdUser.id,
                        organizationId: invite.organizationId,
                        clientLEId: null,
                        role: invite.role,
                    },
                });

            } else if (scopeType === "LE" && invite.clientLEId) {
                await tx.membership.create({
                    data: {
                        userId: createdUser.id,
                        organizationId: null,
                        clientLEId: invite.clientLEId,
                        role: invite.role,
                    },
                });

            } else if (scopeType === "ENG" && invite.fiEngagementId && invite.fiEngagement) {
                let assignedRole = invite.role;
                if (assignedRole === "ORG_ADMIN") assignedRole = "RELATIONSHIP_ADMIN";
                if (assignedRole === "ORG_MEMBER" || assignedRole === "SUPPLIER_CONTACT") assignedRole = "RELATIONSHIP_USER";

                await tx.membership.create({
                    data: {
                        userId: createdUser.id,
                        organizationId: null,
                        clientLEId: null,
                        fiEngagementId: invite.fiEngagementId,
                        role: assignedRole,
                    },
                });

                if (invite.fiEngagement.status === "INVITED") {
                    await tx.fIEngagement.update({
                        where: { id: invite.fiEngagementId },
                        data: { status: "CONNECTED" },
                    });
                }

                await tx.engagementActivity.create({
                    data: {
                        fiEngagementId: invite.fiEngagementId,
                        userId: createdUser.id,
                        type: "INVITE_ACCEPTED",
                        details: { email: invite.sentToEmail, role: invite.role },
                    },
                });
            }

            // Reconcile question assignments
            await reconcileQuestionAssignments(invite.sentToEmail, { clientLEId: invite.clientLEId, fiEngagementId: invite.fiEngagementId, organizationId: invite.organizationId }, createdUser.id, tx);

            // Mark invitation as used
            await tx.invitation.update({
                where: { id: invite.id },
                data: { usedAt: new Date(), acceptedByUserId: createdUser.id },
            });

            return createdUser;
        });

        // 7. Determine redirect target
        const redirectUrl = await determineRedirectUrl(invite, prisma);

        if (invite.organizationId) revalidatePath(`/app/clients/${invite.organizationId}/team`);

        return { success: true, redirectUrl, userId: newUser.id };

    } catch (e: any) {
        if (e.message === "INVITATION_ALREADY_USED_OR_INVALID") {
            return { success: false, error: "This invitation has already been accepted." };
        }
        if (e.message === "USER_ALREADY_EXISTS") {
            return { success: false, error: "An account with this email already exists." };
        }
        console.error("[registerAndAcceptInvitation] Error:", e);
        return { success: false, error: "An unexpected error occurred during registration. Please try again." };
    }
}

// ============================================================================
// acceptInvitation — Unified Accept Action for Existing Logged-In Users
// ============================================================================

export async function acceptInvitation(rawToken: string) {
    // 1. Hash the incoming token for lookup
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 2. Fetch invitation with all scope relations
    // @ts-ignore
    const invite = await prisma.invitation.findUnique({
        where: { tokenHash },
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
    }) as any;

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
        await prisma.$transaction(async (tx: any) => {
            // Re-verify invitation within transaction
            const freshInvite = await tx.invitation.findUnique({ where: { id: invite.id } });
            if (!freshInvite || freshInvite.usedAt || freshInvite.revokedAt || new Date() > freshInvite.expiresAt) {
                throw new Error("INVITATION_ALREADY_USED_OR_INVALID");
            }

            // Create Membership based on scope
            if (scopeType === "ORG" && invite.organizationId) {
                const existing = await tx.membership.findFirst({
                    where: { userId: user.id, organizationId: invite.organizationId, clientLEId: null },
                });
                if (!existing) {
                    await tx.membership.create({
                        data: {
                            userId: user.id,
                            organizationId: invite.organizationId,
                            clientLEId: null,
                            role: invite.role,
                        },
                    });
                }

            } else if (scopeType === "LE" && invite.clientLEId) {
                const existing = await tx.membership.findFirst({
                    where: { userId: user.id, clientLEId: invite.clientLEId, organizationId: null },
                });
                if (!existing) {
                    await tx.membership.create({
                        data: {
                            userId: user.id,
                            organizationId: null,
                            clientLEId: invite.clientLEId,
                            role: invite.role,
                        },
                    });
                }

            } else if (scopeType === "ENG" && invite.fiEngagementId && invite.fiEngagement) {
                const existing = await tx.membership.findFirst({
                    where: { userId: user.id, fiEngagementId: invite.fiEngagementId, organizationId: null, clientLEId: null },
                });
                
                let assignedRole = invite.role;
                if (assignedRole === "ORG_ADMIN") assignedRole = "RELATIONSHIP_ADMIN";
                if (assignedRole === "ORG_MEMBER" || assignedRole === "SUPPLIER_CONTACT") assignedRole = "RELATIONSHIP_USER";

                if (!existing) {
                    await tx.membership.create({
                        data: {
                            userId: user.id,
                            organizationId: null,
                            clientLEId: null,
                            fiEngagementId: invite.fiEngagementId,
                            role: assignedRole,
                        },
                    });
                }

                if (invite.fiEngagement.status === "INVITED") {
                    await tx.fIEngagement.update({
                        where: { id: invite.fiEngagementId },
                        data: { status: "CONNECTED" },
                    });
                }

                await tx.engagementActivity.create({
                    data: {
                        fiEngagementId: invite.fiEngagementId,
                        userId: user.id,
                        type: "INVITE_ACCEPTED",
                        details: { email: invite.sentToEmail, role: invite.role },
                    },
                });
            }

            // Reconcile question assignments
            await reconcileQuestionAssignments(invite.sentToEmail, { clientLEId: invite.clientLEId, fiEngagementId: invite.fiEngagementId, organizationId: invite.organizationId }, user.id, tx);

            // Mark invitation as used
            await tx.invitation.update({
                where: { id: invite.id },
                data: { usedAt: new Date(), acceptedByUserId: user.id },
            });
        });

        const redirectUrl = await determineRedirectUrl(invite, prisma);

        if (invite.organizationId) revalidatePath(`/app/clients/${invite.organizationId}/team`);

        return { success: true, redirectUrl };

    } catch (e: any) {
        if (e.message === "INVITATION_ALREADY_USED_OR_INVALID") {
            return { success: false, error: "This invitation has already been accepted." };
        }
        console.error("[acceptInvitation] Error:", e);
        return { success: false, error: "An unexpected error occurred. Please try again." };
    }
}

