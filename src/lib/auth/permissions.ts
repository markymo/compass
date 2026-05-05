


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

// export const LEGACY_ROLE_MAP = { ... }; // REMOVED

// Define Permissions
export enum Action {
    // LE Management (Org Level)
    LE_CREATE = "le:create",
    LE_UPDATE = "le:update", // Rename, move
    LE_ARCHIVE = "le:archive",
    LE_MANAGE_USERS = "le:manage_users", // Invite to LE
    ORG_MANAGE_TEAM = "org:manage_team", // Invite to Org
    ORG_SELF_JOIN_LE = "org:self_join_le", // Break Glass

    // Engagement / Relationship
    ENG_CREATE = "eng:create",
    ENG_VIEW = "eng:view",
    ENG_UPDATE = "eng:update",
    ENG_DELETE = "eng:delete",

    // --- ADDED IN PHASE 3 ---
    // Master Data
    LE_VIEW_MASTER_DATA = "le:view_master_data",
    LE_EDIT_MASTER_DATA = "le:edit_master_data",
    LE_SIGNOFF_MASTER_DATA = "le:signoff_master_data",

    // Relationship Data
    ENG_VIEW_RELEASED_DATA = "eng:view_released_data",
    ENG_EDIT_DRAFT_RESPONSES = "eng:edit_draft_responses",
    ENG_SIGNOFF_RESPONSES = "eng:signoff_responses",
    ENG_MANAGE_USERS = "eng:manage_users",

    // Questionnaire Templates
    QUESTIONNAIRE_CREATE = "questionnaire:create",
    QUESTIONNAIRE_UPDATE = "questionnaire:update",
    QUESTIONNAIRE_DELETE = "questionnaire:delete",
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
    [Role.ORG_MEMBER]: [
        Action.ENG_VIEW, // Members can see relationships
        Action.ENG_VIEW_RELEASED_DATA
    ],

    // LE Level
    [Role.LE_ADMIN]: [
        Action.LE_UPDATE, // Added per user request
        Action.LE_MANAGE_USERS, // Invite others to THIS LE
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

    // Supplier Level
    [Role.SUPPLIER_ADMIN]: [
        Action.ORG_MANAGE_TEAM,
        Action.QUESTIONNAIRE_CREATE,
        Action.QUESTIONNAIRE_UPDATE,
        Action.QUESTIONNAIRE_DELETE
    ],
    [Role.RELATIONSHIP_ADMIN]: [
        Action.ENG_VIEW,
        Action.ENG_UPDATE, // Sign off
        
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
    }[];
}

interface ValidationContext {
    partyId?: string; // If checking Party Admin rights
    clientLEId?: string; // If checking LE rights
    engagementId?: string; // If checking FI Engagement rights
}

// The Core 'can' function
export async function can(
    user: UserWithMemberships,
    action: Action,
    context: ValidationContext,
    prisma: { clientLEOwner: { findMany: Function }, fIEngagement?: { findUnique: Function } } & Record<string, any>
): Promise<boolean> {

    // 1. System Admin Override
    if (hasRole(user, Role.SYSTEM_ADMIN)) return true;

    // 2. Engagement Boundary Check
    // For any action scoped to an engagement (eng: prefix), the context MUST provide engagementId.
    // This prevents falling back to broader LE/Org scopes accidentally if the caller forgets to pass the ID.
    if (action.startsWith("eng:") && !context.engagementId) {
        return false;
    }

    // 3. Check Direct Context Membership (Strict Scoping)

    // A. Engagement Context
    // FI Users (RELATIONSHIP_ADMIN, RELATIONSHIP_USER) are strictly authorized here.
    if (context.engagementId) {
        // 1. Direct Engagement assignment
        const engRole = getRoleForEngagement(user, context.engagementId);
        if (engRole && checkPermission(engRole, action)) return true;

        // 2. Downward Inheritance for Client-side ONLY
        // To inherit Client roles (LE_ADMIN, ORG_ADMIN), we must know the ClientLE associated with this engagement.
        // If clientLEId is not provided in context, fetch it to ensure Client users can manage engagements.
        if (!context.clientLEId && prisma.fIEngagement) {
            const eng = await prisma.fIEngagement.findUnique({
                where: { id: context.engagementId },
                select: { clientLEId: true }
            });
            if (eng) {
                context.clientLEId = eng.clientLEId;
            }
        }
    }

    // B. LE Context (Data Access)
    // Client-side Users (LE_ADMIN, LE_USER) are authorized here, cascading down to engagement data.
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

    // C. Org Context (Management Access)
    // Tenant Admins (ORG_ADMIN, SUPPLIER_ADMIN) are authorized here.
    // FI-side Org roles (SUPPLIER_ADMIN) will naturally fail to inherit engagement access
    // because they are not granted eng:* actions in ROLE_PERMISSIONS.
    if (context.partyId) {
        const orgRole = getRoleForOrg(user, context.partyId);
        if (orgRole && checkPermission(orgRole, action)) return true;
    }

    return false;
}

// Helpers
function hasRole(user: UserWithMemberships, role: string): boolean {
    return user.memberships.some((m: any) => m.role === role);
}

function getRoleForEngagement(user: UserWithMemberships, engagementId: string): string | undefined {
    // Strict assignment: membership must explicitly link to the FI Engagement
    const membership = user.memberships.find((m: any) => m.fiEngagementId === engagementId);
    return membership?.role;
}

function getRoleForLE(user: UserWithMemberships, leId: string): string | undefined {
    // Direct LE membership (fiEngagementId must be falsy to prevent leakage)
    const membership = user.memberships.find((m: any) => m.clientLEId === leId && !m.fiEngagementId);
    return membership?.role;
}

function getRoleForOrg(user: UserWithMemberships, orgId: string): string | undefined {
    // Org membership (clientLEId and fiEngagementId must be falsy)
    const membership = user.memberships.find((m: any) => m.organizationId === orgId && !m.clientLEId && !m.fiEngagementId);
    return membership?.role;
}

function checkPermission(role: string, action: Action): boolean {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes("*")) return true;
    return perms.includes(action);
}
