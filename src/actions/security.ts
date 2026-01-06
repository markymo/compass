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
    return role === "ADMIN";
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
