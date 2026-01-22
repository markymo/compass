"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

/**
 * Checks if the current user has a SYSTEM role across any organization.
 */
export async function isSystemAdmin() {
    const identity = await getIdentity();
    if (!identity) return false;

    // Check for membership in a SYSTEM type organization
    const adminMembership = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            organization: {
                types: { has: "SYSTEM" }
            }
        }
    });

    return !!adminMembership;
}

/**
 * Gets the user's role in a specific organization (Party Scope).
 */
export async function getUserOrgRole(orgId: string) {
    const identity = await getIdentity();
    if (!identity) return null;

    const membership = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            organizationId: orgId
        }
    });

    return membership?.role || null;
}

/**
 * Gets the user's role in a specific Workspace (ClientLE Scope).
 */
export async function getUserWorkspaceRole(leId: string) {
    const identity = await getIdentity();
    if (!identity) return null;

    const membership = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            clientLEId: leId
        }
    });

    return membership?.role || null;
}


/**
 * Determines if a user can manage (edit/save/extract) a specific questionnaire.
 * Permission: System Admin OR Org Admin of the owning organization (Party).
 */
export async function canManageQuestionnaire(questionnaireId: string) {
    const identity = await getIdentity();
    if (!identity) return false;

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
    // Find all Client Orgs where user is ADMIN (Party Level)
    const userClientMemberships = await prisma.membership.findMany({
        where: {
            userId: identity.userId,
            role: "ADMIN",
            organization: { types: { has: "CLIENT" } }
        },
        select: { organizationId: true }
    });

    if (userClientMemberships.length > 0) {
        // Filter out nulls (shouldn't happen due to query but safe typing)
        const clientOrgIds = userClientMemberships
            .map((m: { organizationId: string | null }) => m.organizationId)
            .filter((id): id is string => id !== null);

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

    // 4. NEW: Direct Workspace Access
    // If the questionnaire is linked to an Engagement, check if user has direct access to the relevant LE
    // This part requires querying the questionnaire's engagement -> LE
    // For now, retaining original logic scope + Party Admin

    return false;
}

/**
 * Determines if a user can view a specific questionnaire.
 * Permission: System Admin OR MEMBER of the owning Party OR Member of associated Workspace.
 */
export async function canViewQuestionnaire(questionnaireId: string) {
    const identity = await getIdentity();
    if (!identity) return false;

    if (await isSystemAdmin()) return true;

    const q = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { fiOrgId: true }
    });

    if (!q) return false;

    // Party Level Check
    const role = await getUserOrgRole(q.fiOrgId);
    return !!role;
}

/**
 * Gets the FI organization the user belongs to (if any).
 */
export async function getUserFIOrg() {
    const identity = await getIdentity();
    if (!identity) return null;

    const membership = await prisma.membership.findFirst({
        where: {
            userId: identity.userId,
            organization: { types: { has: "FI" } }
        },
        include: { organization: true }
    });

    return membership?.organization || null;
}
