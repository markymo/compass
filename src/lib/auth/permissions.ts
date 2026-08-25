


// Define Explicit Roles
export enum Role {
    // System
    SYSTEM_ADMIN = "SYSTEM_ADMIN",

    // Organization (Tenant) Level
    ORG_ADMIN = "ORG_ADMIN",       // Administers the Organization (capabilities determined by Organization.types)
    ORG_MEMBER = "ORG_MEMBER",     // Base state. NO operational data.

    // Legal Entity (Work) Level
    LE_ADMIN = "LE_ADMIN",         // Sign-off, Manage LE Users. FULL LE DATA.
    LE_USER = "LE_USER",           // Edit/View Data. NO Sign-off.

    // Relationship Level (Operational Supplier Roles)
    RELATIONSHIP_ADMIN = "RELATIONSHIP_ADMIN", // Engagement Lead
    RELATIONSHIP_USER = "RELATIONSHIP_USER"    // Engagement Worker
}

// Define Permissions
export enum Action {
    // LE Management (Org Level - Client Organizations)
    LE_CREATE = "le:create",
    LE_UPDATE = "le:update", // Rename, move
    LE_ARCHIVE = "le:archive",
    LE_MANAGE_USERS = "le:manage_users", // Invite to LE
    ORG_MANAGE_TEAM = "org:manage_team", // Invite to Org
    ORG_MANAGE_BILLING = "org:manage_billing", // Update Billing
    ORG_SELF_JOIN_LE = "org:self_join_le", // Break Glass

    // LE Operational (Data Level - Explicit LE Roles)
    LE_VIEW_MASTER_DATA = "le:view_master_data",
    LE_EDIT_MASTER_DATA = "le:edit_master_data",
    LE_SIGNOFF_MASTER_DATA = "le:signoff_master_data",

    // Engagement / Relationship
    ENG_CREATE = "eng:create",
    ENG_VIEW = "eng:view",
    ENG_UPDATE = "eng:update",
    ENG_DELETE = "eng:delete",

    // Relationship Data
    ENG_VIEW_RELEASED_DATA = "eng:view_released_data",
    ENG_EDIT_DRAFT_RESPONSES = "eng:edit_draft_responses",
    ENG_SIGNOFF_RESPONSES = "eng:signoff_responses",
    ENG_MANAGE_USERS = "eng:manage_users",

    // Questionnaire Templates (Org Level - Supplier Organizations)
    QUESTIONNAIRE_CREATE = "questionnaire:create",
    QUESTIONNAIRE_UPDATE = "questionnaire:update",
    QUESTIONNAIRE_DELETE = "questionnaire:delete",
}

// Client-specific Org Admin actions (requires CLIENT in Organization.types when authorized via ORG_ADMIN)
export const CLIENT_ORG_ACTIONS = new Set<Action>([
    Action.LE_CREATE,
    Action.LE_UPDATE,
    Action.LE_ARCHIVE,
    Action.LE_MANAGE_USERS,
    Action.ORG_SELF_JOIN_LE,
]);

// Supplier-specific Org Admin actions (requires SUPPLIER, FI, LAW_FIRM, or OTHER in Organization.types when authorized via ORG_ADMIN)
export const SUPPLIER_ORG_ACTIONS = new Set<Action>([
    Action.QUESTIONNAIRE_CREATE,
    Action.QUESTIONNAIRE_UPDATE,
    Action.QUESTIONNAIRE_DELETE,
]);

export function isActionAllowedForOrgTypes(action: Action, orgTypes: string[]): boolean {
    if (CLIENT_ORG_ACTIONS.has(action)) {
        return orgTypes.includes("CLIENT");
    }
    if (SUPPLIER_ORG_ACTIONS.has(action)) {
        return orgTypes.some((t: string) => ["SUPPLIER", "FI", "LAW_FIRM", "OTHER"].includes(t));
    }
    // Common actions (ORG_MANAGE_TEAM, ORG_MANAGE_BILLING, etc.) require no specific organization subtype
    return true;
}

// Role -> Permissions Mapping
const ROLE_PERMISSIONS: Record<string, string[]> = {
    [Role.SYSTEM_ADMIN]: ["*"],

    // Org Level
    [Role.ORG_ADMIN]: [
        // Common
        Action.ORG_MANAGE_TEAM,
        Action.ORG_MANAGE_BILLING,

        // Client-specific (enforced centrally via Organization.types in can())
        Action.LE_CREATE,
        Action.LE_UPDATE,
        Action.LE_ARCHIVE,
        Action.LE_MANAGE_USERS,
        Action.ORG_SELF_JOIN_LE,

        // Supplier-specific (enforced centrally via Organization.types in can())
        Action.QUESTIONNAIRE_CREATE,
        Action.QUESTIONNAIRE_UPDATE,
        Action.QUESTIONNAIRE_DELETE,
    ],
    [Role.ORG_MEMBER]: [
        // Basic organisation membership only — no operational data or relationship access
    ],

    // LE Level
    [Role.LE_ADMIN]: [
        Action.LE_UPDATE,
        Action.LE_ARCHIVE,
        Action.LE_MANAGE_USERS,
        Action.ENG_CREATE,
        Action.ENG_UPDATE,
        Action.ENG_DELETE,
        Action.ENG_VIEW,

        Action.LE_VIEW_MASTER_DATA,
        Action.LE_EDIT_MASTER_DATA,
        Action.LE_SIGNOFF_MASTER_DATA,
        Action.ENG_VIEW_RELEASED_DATA,
        Action.ENG_EDIT_DRAFT_RESPONSES,
        Action.ENG_SIGNOFF_RESPONSES,
        Action.ENG_MANAGE_USERS
    ],
    [Role.LE_USER]: [
        Action.ENG_CREATE,
        Action.ENG_UPDATE,
        Action.ENG_VIEW,

        Action.LE_VIEW_MASTER_DATA,
        Action.LE_EDIT_MASTER_DATA,
        Action.ENG_VIEW_RELEASED_DATA,
        Action.ENG_EDIT_DRAFT_RESPONSES
    ],

    // Supplier / Relationship Level
    [Role.RELATIONSHIP_ADMIN]: [
        Action.ENG_VIEW,
        Action.ENG_UPDATE,
        
        Action.ENG_VIEW_RELEASED_DATA,
        Action.ENG_EDIT_DRAFT_RESPONSES,
        Action.ENG_SIGNOFF_RESPONSES,
        Action.ENG_MANAGE_USERS,
        Action.QUESTIONNAIRE_UPDATE
    ],
    [Role.RELATIONSHIP_USER]: [
        Action.ENG_VIEW,
        Action.ENG_UPDATE,
        
        Action.ENG_VIEW_RELEASED_DATA,
        Action.ENG_EDIT_DRAFT_RESPONSES
    ]
};

// Types
export interface UserWithMemberships {
    id: string;
    memberships: {
        organizationId?: string | null;
        clientLEId?: string | null;
        fiEngagementId?: string | null;
        role: string;
        clientLE?: { isDeleted: boolean; status?: string | null } | null;
        organization?: { types?: string[] } | null;
    }[];
}

interface ValidationContext {
    partyId?: string; // If checking Party Admin rights
    clientLEId?: string; // If checking LE rights
    engagementId?: string; // If checking FI Engagement rights
}

async function resolveOrgTypes(orgId: string, user: UserWithMemberships, prisma: any): Promise<string[]> {
    const mem = user.memberships.find((m: any) => m.organizationId === orgId);
    if (mem?.organization?.types && Array.isArray(mem.organization.types)) {
        return mem.organization.types;
    }
    if (prisma?.organization?.findUnique) {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { types: true }
        });
        if (org?.types) return org.types;
    }
    return [];
}

// The Core 'can' function
export async function can(
    user: UserWithMemberships,
    action: Action,
    context: ValidationContext,
    prisma: { clientLEOwner?: { findMany: Function }, fIEngagement?: { findUnique: Function }, clientLE?: { findUnique: Function }, organization?: { findUnique: Function } } & Record<string, any>
): Promise<boolean> {

    // 1. System Admin Override
    if (hasRole(user, Role.SYSTEM_ADMIN)) return true;

    // 2. Engagement Boundary Check
    if (action.startsWith("eng:") && !context.engagementId) {
        return false;
    }

    // 3. Check Direct Context Membership (Strict Scoping)

    // A. Engagement Context
    // Relationship Users (RELATIONSHIP_ADMIN, RELATIONSHIP_USER) are strictly authorized here.
    if (context.engagementId) {
        // 1. Direct Engagement assignment
        const engRole = getRoleForEngagement(user, context.engagementId);
        if (engRole && checkPermission(engRole, action)) return true;

        // 2. Downward Inheritance for Client-side ONLY
        // To inherit Client roles (LE_ADMIN, LE_USER), we must know the ClientLE associated with this engagement.
        // If clientLEId is not provided in context, fetch it to ensure Client users can manage engagements.
        if (!context.clientLEId && prisma?.fIEngagement) {
            const eng = await prisma.fIEngagement.findUnique({
                where: { id: context.engagementId },
                select: { clientLEId: true }
            });
            if (eng) {
                context.clientLEId = eng.clientLEId;
            }
        }
    }

    // B. LE Context (Data Access & Structural Management)
    // Client-side Users (LE_ADMIN, LE_USER) are authorized directly here, cascading down to engagement data.
    if (context.clientLEId) {
        // 1. Direct Workspace membership (explicit LE_ADMIN or LE_USER)
        const leRole = getRoleForLE(user, context.clientLEId);
        if (leRole && checkPermission(leRole, action)) {
            const mem = user.memberships.find((m: any) => m.clientLEId === context.clientLEId);
            if (mem?.clientLE) {
                if (!mem.clientLE.isDeleted) return true;
            } else if (prisma?.clientLE) {
                const le = await prisma.clientLE.findUnique({
                    where: { id: context.clientLEId },
                    select: { isDeleted: true }
                });
                if (le && !le.isDeleted) return true;
            } else {
                return true;
            }
        }

        // 2. Ownership Inheritance (Org Admin of the owner Org)
        if (prisma?.clientLEOwner) {
            const owners = (await prisma.clientLEOwner.findMany({
                where: { clientLEId: context.clientLEId, endAt: null },
                include: {
                    clientLE: { select: { isDeleted: true } },
                    party: { select: { types: true } }
                }
            })) || [];

            for (const owner of owners) {
                if (owner.clientLE && owner.clientLE.isDeleted) continue;
                const orgRole = getRoleForOrg(user, owner.partyId);
                if (orgRole && checkPermission(orgRole, action)) {
                    // When authorization is granted via ORG_ADMIN authority, enforce Organization.types
                    if (orgRole === Role.ORG_ADMIN) {
                        const orgTypes = owner.party?.types || await resolveOrgTypes(owner.partyId, user, prisma);
                        if (!isActionAllowedForOrgTypes(action, orgTypes)) {
                            continue;
                        }
                    }
                    return true;
                }
            }
        }
    }

    // C. Org Context (Management Access)
    // Generic ORG_ADMIN is authorized here, with capabilities strictly gated by Organization.types.
    if (context.partyId) {
        const orgRole = getRoleForOrg(user, context.partyId);
        if (orgRole && checkPermission(orgRole, action)) {
            if (orgRole === Role.ORG_ADMIN) {
                const orgTypes = await resolveOrgTypes(context.partyId, user, prisma);
                if (!isActionAllowedForOrgTypes(action, orgTypes)) {
                    return false;
                }
            }
            return true;
        }
    }

    return false;
}

// Helpers
function hasRole(user: UserWithMemberships, role: string): boolean {
    return user.memberships.some((m: any) => m.role === role);
}

function getRoleForEngagement(user: UserWithMemberships, engagementId: string): string | undefined {
    const membership = user.memberships.find((m: any) => m.fiEngagementId === engagementId);
    return membership?.role;
}

function getRoleForLE(user: UserWithMemberships, leId: string): string | undefined {
    const membership = user.memberships.find((m: any) => {
        if (m.clientLEId !== leId || m.fiEngagementId) return false;
        if (m.clientLE && m.clientLE.isDeleted) return false;
        return true;
    });
    return membership?.role;
}

function getRoleForOrg(user: UserWithMemberships, orgId: string): string | undefined {
    const membership = user.memberships.find((m: any) => m.organizationId === orgId && !m.clientLEId && !m.fiEngagementId);
    return membership?.role;
}

function checkPermission(role: string, action: Action): boolean {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes("*")) return true;
    return perms.includes(action);
}
