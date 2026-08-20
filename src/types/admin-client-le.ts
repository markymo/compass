export interface ParentOrgSummary {
    id: string;
    name: string;
    shortCode: string | null;
}

export interface AdminClientLEItem {
    id: string;
    name: string;
    shortCode: string | null;
    jurisdiction: string | null;
    lei: string | null;
    status: string;
    isDeleted: boolean;
    createdAt: string;
    parentOrgs: ParentOrgSummary[];
    engagementCount: number;
    memberCount: number;
}

/**
 * Centralized rule for deriving the visual/display status of a ClientLE.
 * Deleted state MUST override operational status visually.
 */
export function getDisplayStatus(le: { isDeleted: boolean; status: string }): "DELETED" | string {
    return le.isDeleted ? "DELETED" : (le.status || "ACTIVE");
}

/**
 * Standardized mapper from raw Prisma ClientLE object (with included relations)
 * to the common AdminClientLEItem data contract.
 */
export function mapClientLEToAdminRow(le: any): AdminClientLEItem {
    const activeOwners = (le.owners || []).filter((o: any) => o && o.party);
    return {
        id: le.id,
        name: le.name || "Unnamed LE",
        shortCode: le.shortCode || null,
        jurisdiction: le.jurisdiction || null,
        lei: le.legalEntity?.lei || le.lei || null,
        status: le.status || "ACTIVE",
        isDeleted: le.isDeleted ?? false,
        createdAt: le.createdAt ? (typeof le.createdAt === "string" ? le.createdAt : le.createdAt.toISOString()) : new Date().toISOString(),
        parentOrgs: activeOwners.map((o: any) => ({
            id: o.party.id,
            name: o.party.name,
            shortCode: o.party.shortCode || null,
        })),
        engagementCount: (le.fiEngagements || []).length,
        memberCount: (le.memberships || []).length,
    };
}
