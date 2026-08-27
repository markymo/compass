"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type TeamMemberLEAssignment = {
    userId: string;
    email: string;
    name?: string | null;
    orgRole: string; // e.g. "Org Admin" | "Org Member" | "LE User" | "Invited"
    leRole: "LE_ADMIN" | "LE_USER" | "NONE";
    isCurrentUser?: boolean;
    isPendingInvite?: boolean;
    invitationId?: string;
};

export async function getClientLETeamAssignments(clientLEId: string, orgId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const currentUserId = identity.userId;

    try {
        // 1. Authorization check: Requester must have membership in this Org or be System Admin
        const orgMembership = await prisma.membership.findFirst({
            where: {
                userId: currentUserId,
                organizationId: orgId,
            }
        });

        if (!orgMembership) {
            return { success: false, error: "Unauthorized: You do not belong to this organization." };
        }

        // 2. Fetch all ClientLEs owned by this Client Organization
        const ownedLEs = await prisma.clientLEOwner.findMany({
            where: { partyId: orgId, endAt: null, clientLE: { isDeleted: false } },
            select: { clientLEId: true }
        });
        const ownedLeIds = ownedLEs.map((o: any) => o.clientLEId);
        if (!ownedLeIds.includes(clientLEId)) {
            ownedLeIds.push(clientLEId);
        }

        // 3. Fetch distinct union of eligible members (filtering out demo users)
        const allMemberships = await prisma.membership.findMany({
            where: {
                OR: [
                    { organizationId: orgId },
                    { clientLEId: { in: ownedLeIds } }
                ],
                user: {
                    isDemoActor: false
                }
            },
            include: { user: true }
        });

        // Map and deduplicate users
        const userMap = new Map<string, { userId: string; email: string; name?: string | null; orgRole: string }>();

        allMemberships.forEach((m: any) => {
            if (!m.user) return;
            const existing = userMap.get(m.userId);

            let derivedRole = "LE User";
            if (m.organizationId === orgId) {
                derivedRole = (m.role === "ORG_ADMIN" || m.role === "ADMIN") ? "Org Admin" : "Org Member";
            }

            if (!existing) {
                userMap.set(m.userId, {
                    userId: m.userId,
                    email: m.user.email,
                    name: m.user.name,
                    orgRole: derivedRole
                });
            } else {
                // If user has an org-level role, prioritize showing Org Admin / Org Member
                if (derivedRole === "Org Admin" || (derivedRole === "Org Member" && existing.orgRole !== "Org Admin")) {
                    existing.orgRole = derivedRole;
                }
            }
        });

        // 4. Fetch existing LE memberships specifically for the target ClientLE
        const leMemberships = await prisma.membership.findMany({
            where: { clientLEId }
        });

        const leRoleMap = new Map<string, "LE_ADMIN" | "LE_USER">();
        leMemberships.forEach((m: any) => {
            if (m.role === "LE_ADMIN" || m.role === "LE_USER") {
                leRoleMap.set(m.userId, m.role);
            }
        });

        // 5. Combine into candidate list
        const members: TeamMemberLEAssignment[] = Array.from(userMap.values()).map((u) => {
            const existingRole = leRoleMap.get(u.userId) || "NONE";
            return {
                ...u,
                leRole: existingRole,
                isCurrentUser: u.userId === currentUserId
            };
        });

        // 6. Fetch active pending invitations specifically for this ClientLE
        const activeInvites = await (prisma.invitation.findMany as any)({
            where: {
                clientLEId,
                usedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

        const existingEmails = new Set(members.map((m) => m.email.toLowerCase()));

        activeInvites.forEach((inv: any) => {
            if (!existingEmails.has(inv.sentToEmail.toLowerCase())) {
                existingEmails.add(inv.sentToEmail.toLowerCase());
                members.push({
                    userId: `invite-${inv.id}`,
                    email: inv.sentToEmail,
                    name: null,
                    orgRole: "Invited",
                    leRole: (inv.role === "LE_ADMIN" || inv.role === "LE_USER") ? inv.role : "LE_USER",
                    isPendingInvite: true,
                    invitationId: inv.id
                });
            }
        });

        // Preferred ordering:
        // 1. Current user
        // 2. Users already assigned to this ClientLE or with active pending invites
        // 3. Remaining eligible candidates alphabetically
        members.sort((a, b) => {
            if (a.isCurrentUser) return -1;
            if (b.isCurrentUser) return 1;

            const aActive = a.leRole !== "NONE" || a.isPendingInvite;
            const bActive = b.leRole !== "NONE" || b.isPendingInvite;

            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;

            return a.email.localeCompare(b.email);
        });

        return {
            success: true,
            currentUserId,
            members
        };
    } catch (e: any) {
        console.error("getClientLETeamAssignments error:", e);
        return { success: false, error: "Failed to fetch team members." };
    }
}

export async function saveClientLEPermissions(data: {
    clientLEId: string;
    orgId: string;
    assignments: Array<{ userId: string; role: "LE_ADMIN" | "LE_USER" | "NONE" }>;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const currentUserId = identity.userId;

    const { clientLEId, orgId, assignments } = data;

    try {
        // 1. Server-side Authorization Check: Must be ORG_ADMIN of the owning Org
        const requesterMembership = await prisma.membership.findFirst({
            where: {
                userId: currentUserId,
                organizationId: orgId,
                role: { in: ["ORG_ADMIN", "ADMIN"] }
            }
        });

        if (!requesterMembership) {
            return {
                success: false,
                error: "Unauthorized: Only an Organization Admin can manage ClientLE team access."
            };
        }

        // Filter out pending invitation rows (their IDs start with 'invite-')
        const realAssignments = assignments.filter((a) => !a.userId.startsWith("invite-"));

        // 2. Validate that all target real users belong to this Client Organization or its ClientLEs
        const ownedLEs = await prisma.clientLEOwner.findMany({
            where: { partyId: orgId, endAt: null, clientLE: { isDeleted: false } },
            select: { clientLEId: true }
        });
        const ownedLeIds = ownedLEs.map((o: any) => o.clientLEId);
        if (!ownedLeIds.includes(clientLEId)) {
            ownedLeIds.push(clientLEId);
        }

        const targetUserIds = realAssignments.map((a) => a.userId);
        const validMemberships = await prisma.membership.findMany({
            where: {
                userId: { in: targetUserIds },
                OR: [
                    { organizationId: orgId },
                    { clientLEId: { in: ownedLeIds } }
                ]
            },
            select: { userId: true }
        });

        const validUserSet = new Set(validMemberships.map((m: any) => m.userId));

        for (const item of realAssignments) {
            if (!validUserSet.has(item.userId)) {
                return {
                    success: false,
                    error: `Unauthorized: User ${item.userId} is not associated with this Client Organization.`
                };
            }
        }

        // 3. Apply role assignments for real users
        for (const item of realAssignments) {
            const existing = await prisma.membership.findFirst({
                where: {
                    userId: item.userId,
                    clientLEId
                }
            });

            if (item.role === "NONE") {
                if (existing) {
                    await prisma.membership.delete({
                        where: { id: existing.id }
                    });
                }
            } else {
                if (existing) {
                    await prisma.membership.update({
                        where: { id: existing.id },
                        data: { role: item.role }
                    });
                } else {
                    await prisma.membership.create({
                        data: {
                            userId: item.userId,
                            clientLEId,
                            role: item.role
                        }
                    });
                }
            }
        }

        revalidatePath(`/app/clients/${orgId}`);
        revalidatePath(`/app/clients/${orgId}/team`);
        revalidatePath(`/app/le/${clientLEId}`);

        return { success: true };
    } catch (e: any) {
        console.error("saveClientLEPermissions error:", e);
        return {
            success: false,
            error: "Failed to save team permissions. Please try again."
        };
    }
}
