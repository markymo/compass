
import { PrismaClient } from "@prisma/client";

// Define Roles
export enum Role {
    // System
    SYSTEM_ADMIN = "SYSTEM_ADMIN",

    // Party Scope
    CLIENT_ADMIN = "CLIENT_ADMIN",
    SUPPLIER_ADMIN = "SUPPLIER_ADMIN",
    MEMBER = "MEMBER",

    // LE Scope
    LE_ADMIN = "ADMIN", // Reusing existing string values from DB if possible, or mapping
    LE_CONTRIBUTOR = "CONTRIBUTOR",

    // Engagement Scope
    ENGAGEMENT_ADMIN = "ENGAGEMENT_ADMIN",
    ENGAGEMENT_USER = "ENGAGEMENT_USER"
}

// Define Permissions
export enum Action {
    // LE Management
    LE_CREATE = "le:create",
    LE_UPDATE = "le:update", // Rename, move
    LE_ARCHIVE = "le:archive",
    LE_MANAGE_USERS = "le:manage_users",

    // LE Operational
    LE_VIEW_DATA = "le:view_data", // See docs, responses
    LE_EDIT_DATA = "le:edit_data", // Upload docs, answer questions
    LE_SIGNOFF = "le:signoff",

    // Engagement
    ENG_CREATE = "eng:create",
    ENG_VIEW = "eng:view",
}

// Role -> Permissions Mapping
const ROLE_PERMISSIONS: Record<string, string[]> = {
    [Role.SYSTEM_ADMIN]: ["*"], // God mode

    // Client Party Admin (Provisioning Only)
    [Role.CLIENT_ADMIN]: [
        Action.LE_CREATE,
        Action.LE_UPDATE,
        Action.LE_ARCHIVE,
        Action.LE_MANAGE_USERS
        // NO LE_VIEW_DATA by default!
    ],

    // Client LE Roles
    [Role.LE_ADMIN]: [
        Action.LE_VIEW_DATA,
        Action.LE_EDIT_DATA,
        Action.LE_SIGNOFF,
        Action.LE_MANAGE_USERS
    ],
    [Role.LE_CONTRIBUTOR]: [
        Action.LE_VIEW_DATA,
        Action.LE_EDIT_DATA
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
    prisma: PrismaClient // Pass prisma instance to avoid circular imports or direct instantiation
): Promise<boolean> {

    // 1. System Admin Override
    if (hasRole(user, Role.SYSTEM_ADMIN)) return true;

    // 2. Check Direct Context Membership (Fastest)
    if (context.clientLEId) {
        const leRole = getRoleForLE(user, context.clientLEId);
        if (leRole && checkPermission(leRole, action)) return true;
    }

    // 3. Check Ownership-Based Inheritance (Provisioning Only)
    // Only verify ownership if the action is Administrative
    const isProvisioningAction = [
        Action.LE_CREATE, Action.LE_UPDATE, Action.LE_ARCHIVE, Action.LE_MANAGE_USERS
    ].includes(action);

    if (context.clientLEId && isProvisioningAction) {
        // Is user a Client Party Admin?
        const partyIdsKeyed = getPartyAdminIds(user);

        if (partyIdsKeyed.length > 0) {
            // Check if any of these parties CURRENTLY own the LE
            const ownership = await prisma.clientLEOwner.findFirst({
                where: {
                    clientLEId: context.clientLEId,
                    partyId: { in: partyIdsKeyed },
                    endAt: null // Must be current owner
                }
            });
            if (ownership) return true;
        }
    }

    return false;
}

// Helpers
function hasRole(user: UserWithMemberships, role: string): boolean {
    return user.memberships.some(m => m.role === role);
}

function getRoleForLE(user: UserWithMemberships, leId: string): string | undefined {
    // Direct LE membership
    const membership = user.memberships.find(m => m.clientLEId === leId);
    return membership?.role;
}

function getPartyAdminIds(user: UserWithMemberships): string[] {
    return user.memberships
        .filter(m => m.organizationId && m.role === "ADMIN") // "ADMIN" is the legacy definition for Client Admin
        .map(m => m.organizationId as string);
}

function checkPermission(role: string, action: Action): boolean {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes("*")) return true;
    return perms.includes(action);
}
