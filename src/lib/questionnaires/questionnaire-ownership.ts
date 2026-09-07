import prisma from "@/lib/prisma";

/**
 * Positively verifies whether a Questionnaire record is a platform-owned asset
 * (e.g. standard reference templates, global library snapshots) belonging to the
 * System Organisation.
 * 
 * Rules:
 * 1. Live customer engagement questionnaires (fiEngagementId != null) are NEVER platform assets.
 * 2. Unattached questionnaires owned by tenant organisations (Supplier / Client / FI) are
 *    TENANT assets, not platform assets, and return false.
 * 3. Only unattached questionnaires whose fiOrg or ownerOrg has types containing "SYSTEM"
 *    are platform assets and return true.
 */
export async function isPlatformQuestionnaire(
    q: {
        id?: string;
        fiEngagementId?: string | null;
        fiOrgId?: string;
        ownerOrgId?: string | null;
        fiOrg?: { types?: string[] | null } | null;
        ownerOrg?: { types?: string[] | null } | null;
    },
    prismaClient: any = prisma
): Promise<boolean> {
    // 1. Live engagement questionnaires are NEVER platform assets
    if (q.fiEngagementId) {
        return false;
    }

    // 2. Preloaded Organization types check
    if (q.fiOrg?.types && Array.isArray(q.fiOrg.types) && q.fiOrg.types.includes("SYSTEM")) {
        return true;
    }
    if (q.ownerOrg?.types && Array.isArray(q.ownerOrg.types) && q.ownerOrg.types.includes("SYSTEM")) {
        return true;
    }

    // 3. Query DB if types were not preloaded
    const orgIds = [q.fiOrgId, q.ownerOrgId].filter(Boolean) as string[];
    if (orgIds.length > 0 && prismaClient?.organization?.findFirst) {
        const sysOrg = await prismaClient.organization.findFirst({
            where: {
                id: { in: orgIds },
                types: { has: "SYSTEM" }
            },
            select: { id: true }
        });
        if (sysOrg) return true;
    }

    // 4. If only questionnaire ID was passed without preloaded org info or IDs, fetch from DB
    if (q.id && q.fiOrg === undefined && q.ownerOrg === undefined && !q.fiOrgId && !q.ownerOrgId && prismaClient?.questionnaire?.findUnique) {
        const fullQ = await prismaClient.questionnaire.findUnique({
            where: { id: q.id },
            select: {
                fiEngagementId: true,
                fiOrg: { select: { types: true } },
                ownerOrg: { select: { types: true } }
            }
        });
        if (fullQ) {
            if (fullQ.fiEngagementId) return false;
            return !!(fullQ.fiOrg?.types?.includes("SYSTEM") || fullQ.ownerOrg?.types?.includes("SYSTEM"));
        }
    }

    return false;
}
