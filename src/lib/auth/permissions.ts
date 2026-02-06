
import { PrismaClient } from "@prisma/client";

// Define Explicit Roles
export enum Role {
    // System
    SYSTEM_ADMIN = "SYSTEM_ADMIN",

    // Organization (Tenant) Level
    ORG_ADMIN = "ORG_ADMIN",       // Billing, Users, LE Creation. NO LE DATA.
    ORG_MEMBER = "ORG_MEMBER",     // Base state. NO LE DATA.

    // Legal Entity (Work) Level
    LE_ADMIN = "LE_ADMIN",         // Sign-off, Manage LE Users. FULL LE DATA.
    LE_USER = "LE_USER",           // Edit/View Data. NO Sign-off.

    // Supplier Level
    SUPPLIER_ADMIN = "SUPPLIER_ADMIN", // Tenant Admin for FI/LawFirm
    RELATIONSHIP_ADMIN = "RELATIONSHIP_ADMIN", // Engagement Lead
    RELATIONSHIP_USER = "RELATIONSHIP_USER"    // Engagement Worker
}

// Legacy Mappings (for migration support if needed)
export const LEGACY_ROLE_MAP: Record<string, string> = {
    "ADMIN": Role.ORG_ADMIN, // Default to Org Admin if ambiguous
    "MEMBER": Role.ORG_MEMBER
};

// Define Permissions
export enum Action {
    // LE Management (Org Level)
    LE_CREATE = "le:create",
    LE_UPDATE = "le:update", // Rename, move
    LE_ARCHIVE = "le:archive",
    LE_MANAGE_USERS = "le:manage_users", // Invite to LE
    ORG_MANAGE_TEAM = "org:manage_team", // Invite to Org
    ORG_SELF_JOIN_LE = "org:self_join_le", // Break Glass

    // LE Operational (Data Level)
    LE_VIEW_DATA = "le:view_data", // See docs, responses
    LE_EDIT_DATA = "le:edit_data", // Upload docs, answer questions
    LE_SIGNOFF = "le:signoff",     // Approve responses

    // Engagement / Relationship
    ENG_CREATE = "eng:create",
    ENG_VIEW = "eng:view",
    ENG_UPDATE = "eng:update",
    ENG_DELETE = "eng:delete",
}

// Role -> Permissions Mapping
const ROLE_PERMISSIONS: Record<string, string[]> = {
    [Role.SYSTEM_ADMIN]: ["*"],

    // Org Level
    [Role.ORG_ADMIN]: [
        Action.LE_CREATE,
        Action.LE_UPDATE,
        Action.LE_ARCHIVE,
        Action.ORG_MANAGE_TEAM,
        Action.ORG_SELF_JOIN_LE, // Key: Can grant themselves access

        // --- ADDED ---
        // Org Admins have management oversight over all LEs in their Org
        Action.LE_VIEW_DATA,
        Action.LE_MANAGE_USERS,
        Action.ENG_CREATE,
        Action.ENG_UPDATE,
        Action.ENG_DELETE,
        Action.ENG_VIEW
    ],
    [Role.ORG_MEMBER]: [
        Action.ENG_VIEW // Members can see relationships
    ],

    // LE Level
    [Role.LE_ADMIN]: [
        Action.LE_VIEW_DATA,
        Action.LE_EDIT_DATA,
        Action.LE_SIGNOFF,
        Action.LE_MANAGE_USERS, // Invite others to THIS LE
        Action.ENG_CREATE,
        Action.ENG_UPDATE,
        Action.ENG_DELETE,
        Action.ENG_VIEW
    ],
    [Role.LE_USER]: [
        Action.LE_VIEW_DATA,
        Action.LE_EDIT_DATA,
        Action.ENG_CREATE,
        Action.ENG_UPDATE,
        Action.ENG_VIEW
    ],

    // Supplier Level
    [Role.SUPPLIER_ADMIN]: [
        Action.ORG_MANAGE_TEAM
    ],
    [Role.RELATIONSHIP_ADMIN]: [
        Action.ENG_VIEW,
        Action.ENG_UPDATE, // Sign off
        Action.LE_VIEW_DATA // Often needs to see LE data
    ],
    [Role.RELATIONSHIP_USER]: [
        Action.ENG_VIEW,
        Action.ENG_UPDATE
    ]
};

// Types
export interface UserWithMemberships {
    id: string;
    memberships: {
        organizationId?: string | null;
        clientLEId?: string | null;
        role: string;
    }[];
}

interface ValidationContext {
    partyId?: string; // If checking Party Admin rights
    clientLEId?: string; // If checking LE rights
    engagementId?: string;
}

// The Core 'can' function
export async function can(
    user: UserWithMemberships,
    action: Action,
    context: ValidationContext,
    prisma: PrismaClient
): Promise<boolean> {

    // 1. System Admin Override
    if (hasRole(user, Role.SYSTEM_ADMIN)) return true;

    // 2. Check Direct Context Membership (Strict Scoping)

    // A. LE Context (Data Access)
    if (context.clientLEId) {
        // 1. Direct Workspace membership
        const leRole = getRoleForLE(user, context.clientLEId);
        if (leRole && checkPermission(leRole, action)) return true;

        // 2. Ownership Inheritance (Org Admin of the owner Org)
        const owners = await prisma.clientLEOwner.findMany({
            where: { clientLEId: context.clientLEId, endAt: null },
            select: { partyId: true }
        });

        for (const owner of owners) {
            const orgRole = getRoleForOrg(user, owner.partyId);
            if (orgRole && checkPermission(orgRole, action)) return true;
        }
    }

    // B. Org Context (Management Access)
    if (context.partyId) {
        const orgRole = getRoleForOrg(user, context.partyId);
        if (orgRole && checkPermission(orgRole, action)) return true;
    }

    // 3. Inheritance (REMOVED/LIMITED)
    // We removed "All LE access" from Org Admins.
    // However, for Creating/Updating an LE, we check the Org Context (handled in B above).

    // Note on "Break Glass":
    // The UI will check `can(user, ORG_SELF_JOIN_LE, { partyId: ... })`.
    // If true, showing the "Join" button is allowed.
    // The actual action will create a membership.

    return false;
}

// Helpers
function hasRole(user: UserWithMemberships, role: string): boolean {
    return user.memberships.some(m => m.role === role);
}

function getRoleForLE(user: UserWithMemberships, leId: string): string | undefined {
    // Direct LE membership
    const membership = user.memberships.find(m => m.clientLEId === leId);
    return mapLegacyRole(membership?.role, "LE");
}

function getRoleForOrg(user: UserWithMemberships, orgId: string): string | undefined {
    // Org membership (clientLEId is null)
    const membership = user.memberships.find(m => m.organizationId === orgId && !m.clientLEId);
    return mapLegacyRole(membership?.role, "ORG");
}

function checkPermission(role: string, action: Action): boolean {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes("*")) return true;
    return perms.includes(action);
}

// Temp Helper to support old "ADMIN" strings during dev until migration
function mapLegacyRole(roleName?: string, scope?: "ORG" | "LE"): string | undefined {
    if (!roleName) return undefined;
    if (roleName === "ADMIN") {
        return scope === "LE" ? Role.LE_ADMIN : Role.ORG_ADMIN;
    }
    if (roleName === "MEMBER") {
        return scope === "LE" ? Role.LE_USER : Role.ORG_MEMBER;
    }
    return roleName;
}
