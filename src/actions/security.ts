"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

/**
 * Checks if the current user has a SYSTEM role across any organization.
 */
export async function isSystemAdmin() {
    const { userId } = await auth();
    if (!userId) return false;

    const adminRole = await prisma.userOrganizationRole.findFirst({
        where: {
            userId: userId,
            org: {
                types: { has: "SYSTEM" }
            }
        }
    });

    return !!adminRole;
}

/**
 * Gets the user's role in a specific organization.
 */
export async function getUserOrgRole(orgId: string) {
    const { userId } = await auth();
    if (!userId) return null;

    const roleEntry = await prisma.userOrganizationRole.findUnique({
        where: {
            userId_orgId: {
                userId,
                orgId
            }
        }
    });

    return roleEntry?.role || null;
}

/**
 * Determines if a user can manage (edit/save/extract) a specific questionnaire.
 * Permission: System Admin OR Org Admin of the owning organization.
 */
export async function canManageQuestionnaire(questionnaireId: string) {
    const { userId } = await auth();
    if (!userId) return false;

    // 1. System Admins can always manage
    if (await isSystemAdmin()) return true;

    // 2. Find questionnaire and check if user is an ADMIN in that FI Org
    const q = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { fiOrgId: true }
    });

    if (!q) return false;

    const role = await getUserOrgRole(q.fiOrgId);
    if (role === "ADMIN") return true;

    // 3. Allow if user is an ADMIN of a Client LE that has this questionnaire linked
    // Find all Client Orgs where user is ADMIN
    const userClientRoles = await prisma.userOrganizationRole.findMany({
        where: { userId, role: "ADMIN", org: { types: { has: "CLIENT" } } },
        select: { orgId: true }
    });

    if (userClientRoles.length > 0) {
        const clientOrgIds = userClientRoles.map(r => r.orgId);

        // Find LEs for these Orgs
        const clientLEs = await prisma.clientLE.findMany({
            where: { clientOrgId: { in: clientOrgIds } },
            select: { id: true }
        });
        const clientLEIds = clientLEs.map(le => le.id);

        if (clientLEIds.length > 0) {
            // Check if any of these LEs have an engagement with this questionnaire
            const engagement = await prisma.fIEngagement.findFirst({
                where: {
                    clientLEId: { in: clientLEIds },
                    questionnaires: { some: { id: questionnaireId } }
                }
            });

            if (engagement) return true;
        }
    }

    return false;
}

/**
 * Determines if a user can view a specific questionnaire.
 * Permission: System Admin OR ANY member of the owning organization.
 */
export async function canViewQuestionnaire(questionnaireId: string) {
    const { userId } = await auth();
    if (!userId) return false;

    if (await isSystemAdmin()) return true;

    const q = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { fiOrgId: true }
    });

    if (!q) return false;

    const role = await getUserOrgRole(q.fiOrgId);
    return !!role; // Any non-null role means membership
}
