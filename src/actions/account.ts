"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function findUser(identity: { userId: string; email?: string | null }) {
    // Try by ID first
    let user = await (prisma.user as any).findFirst({
        where: { id: identity.userId }
    });

    // If not found, try by email as fallback (identity mismatch workaround)
    if (!user && identity.email) {
        user = await (prisma.user as any).findFirst({
            where: { email: identity.email }
        });
    }

    return user;
}

export async function getAccountSettings() {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const user = await findUser(identity);
        if (!user) return { success: false, error: "User not found" };

        const accounts = await prisma.account.findMany({
            where: { userId: user.id }
        });

        const dbUserHasPassword = await (prisma.user as any).findFirst({
            where: { id: user.id },
            select: { password: true }
        });

        let authMethod = "Email / Password";
        if (accounts.length > 0) {
            authMethod = `SSO (${accounts[0].provider})`;
        } else if (!dbUserHasPassword?.password) {
            authMethod = "Magic Link / Invite";
        }

        return {
            success: true,
            data: {
                ...user,
                authMethod
            }
        };
    } catch (error) {
        console.error("[getAccountSettings] Error:", error);
        return { success: false, error: "An internal error occurred." };
    }
}

function deepMerge(target: any, source: any) {
    const isObject = (obj: any) => obj && typeof obj === 'object' && !Array.isArray(obj);
    const result = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) Object.assign(result, { [key]: source[key] });
                else result[key] = deepMerge(target[key], source[key]);
            } else {
                Object.assign(result, { [key]: source[key] });
            }
        });
    }
    return result;
}

export async function updateAccountSettings(data: {
    name?: string;
    jobTitle?: string;
    phone?: string;
    notificationPrefs?: any;
    preferences?: any;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const user = await findUser(identity);
        if (!user) return { success: false, error: "User not found" };

        if (data.preferences && data.preferences.timezone !== undefined) {
            const { validateTimezone } = await import("@/lib/date-utils");
            const tz = data.preferences.timezone;
            if (!validateTimezone(tz)) {
                return { success: false, error: "Invalid timezone selected." };
            }
            if (!tz || tz.trim() === '' || tz.toUpperCase() === 'UTC') {
                data.preferences.timezone = "UTC";
            }
        }

        const updatedUser = await (prisma.user as any).update({
            where: { id: user.id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                // @ts-ignore
                ...(data.jobTitle !== undefined && { jobTitle: data.jobTitle }),
                // @ts-ignore
                ...(data.phone !== undefined && { phone: data.phone }),
                // @ts-ignore
                ...(data.notificationPrefs !== undefined && {
                    notificationPrefs: deepMerge((user?.notificationPrefs as any || {}), data.notificationPrefs)
                }),
                // @ts-ignore
                ...(data.preferences !== undefined && {
                    preferences: deepMerge((user?.preferences as any || {}), data.preferences)
                }),
            },
        });

        revalidatePath("/app/account");
        revalidatePath("/app");
        revalidatePath("/");
        return { success: true };
    } catch (e) {
        console.error("[updateAccountSettings] Error:", e);
        return { success: false, error: "An error occurred while saving your settings." };
    }
}

export type PermissionNode = {
    id: string;
    name: string;
    type: "CLIENT" | "SUPPLIER" | "LAW_FIRM" | "SYSTEM" | "LE" | "OTHER";
    href: string;
    permissionLabel: string;
    children?: PermissionNode[];
};

export type PermissionGroups = {
    clients: PermissionNode[];
    suppliers: PermissionNode[];
    others: PermissionNode[];
};

export async function getUserPermissions() {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false as const, error: "Unauthorized" };

    try {
        const user = await findUser(identity);
        if (!user) return { success: false as const, error: "User not found" };

        const memberships = await prisma.membership.findMany({
            where: { userId: user.id },
            include: {
                organization: { select: { id: true, name: true, types: true } },
                clientLE: {
                    select: {
                        id: true,
                        name: true,
                        isDeleted: true,
                        status: true,
                        owners: {
                            where: { endAt: null },
                            select: { party: { select: { id: true, name: true, types: true } } },
                            take: 1,
                        },
                    },
                },
                fiEngagement: {
                    select: {
                        id: true,
                        fiOrgId: true,
                        clientLEId: true,
                        org: { select: { id: true, name: true } },
                        clientLE: { select: { id: true, name: true, isDeleted: true, status: true } },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // Maps for direct memberships
        const orgRoleMap = new Map<string, string>();
        const leRoleMap = new Map<string, string>();
        const engRoleMap = new Map<string, string>();

        memberships.forEach((m: any) => {
            if (m.organizationId && !m.clientLEId && !m.fiEngagementId && m.organization) {
                orgRoleMap.set(m.organizationId, m.role);
            }
            if (m.clientLEId && !m.fiEngagementId && m.clientLE && !m.clientLE.isDeleted) {
                leRoleMap.set(m.clientLEId, m.role);
            }
            if (m.fiEngagementId && m.fiEngagement) {
                engRoleMap.set(m.fiEngagementId, m.role);
            }
        });

        // --- 1. CLIENT ORGANIZATIONS ---
        const clientOrgMap = new Map<string, { id: string; name: string; types: string[] }>();

        // Add direct Client orgs
        memberships.forEach((m: any) => {
            if (m.organization && m.organization.types?.includes("CLIENT")) {
                clientOrgMap.set(m.organization.id, m.organization);
            }
        });

        // Add derived Client orgs from accessible LEs
        memberships.forEach((m: any) => {
            if (m.clientLE && m.clientLE.owners?.[0]?.party) {
                const ownerParty = m.clientLE.owners[0].party;
                if (ownerParty.types?.includes("CLIENT") && !clientOrgMap.has(ownerParty.id)) {
                    clientOrgMap.set(ownerParty.id, ownerParty);
                }
            }
        });

        const clientNodes: PermissionNode[] = [];
        const sortedClientOrgs = Array.from(clientOrgMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        for (const clientOrg of sortedClientOrgs) {
            const explicitOrgRole = orgRoleMap.get(clientOrg.id) || null;
            const isAdmin = explicitOrgRole && ["ORG_ADMIN", "ADMIN", "CLIENT_ADMIN"].includes(explicitOrgRole);

            // Fetch owned LEs for this client
            const ownedLEs = await prisma.clientLEOwner.findMany({
                where: {
                    partyId: clientOrg.id,
                    endAt: null,
                    clientLE: { isDeleted: false, status: { not: "ARCHIVED" } },
                },
                include: {
                    clientLE: { select: { id: true, name: true } },
                },
            });

            const childNodes: PermissionNode[] = [];
            for (const owner of ownedLEs) {
                const le = owner.clientLE;
                const explicitLeRole = leRoleMap.get(le.id) || null;

                // Included if explicit LE role exists OR user is Client Org Admin (structural view)
                if (explicitLeRole || isAdmin) {
                    childNodes.push({
                        id: le.id,
                        name: le.name,
                        type: "LE",
                        href: `/app/le/${le.id}`,
                        permissionLabel: explicitLeRole || "—",
                    });
                }
            }

            childNodes.sort((a, b) => a.name.localeCompare(b.name));

            // Only include client org if user has direct org membership OR visible child LEs
            if (explicitOrgRole || childNodes.length > 0) {
                clientNodes.push({
                    id: clientOrg.id,
                    name: clientOrg.name,
                    type: "CLIENT",
                    href: `/app/clients/${clientOrg.id}`,
                    permissionLabel: explicitOrgRole || "—",
                    children: childNodes,
                });
            }
        }

        // --- 2. SUPPLIER ORGANIZATIONS ---
        const supplierOrgMap = new Map<string, { id: string; name: string; types: string[] }>();

        memberships.forEach((m: any) => {
            if (m.organization && (m.organization.types?.includes("FI") || m.organization.types?.includes("SUPPLIER"))) {
                supplierOrgMap.set(m.organization.id, m.organization);
            }
            if (m.fiEngagement?.org) {
                if (!supplierOrgMap.has(m.fiEngagement.org.id)) {
                    supplierOrgMap.set(m.fiEngagement.org.id, { ...m.fiEngagement.org, types: ["FI"] });
                }
            }
        });

        const supplierNodes: PermissionNode[] = [];
        const sortedSupplierOrgs = Array.from(supplierOrgMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        for (const supplierOrg of sortedSupplierOrgs) {
            const explicitOrgRole = orgRoleMap.get(supplierOrg.id) || null;
            const isSupplierAdmin = explicitOrgRole && ["ORG_ADMIN", "ADMIN"].includes(explicitOrgRole);

            // Fetch engagements for this FI
            const engagements = await prisma.fIEngagement.findMany({
                where: {
                    fiOrgId: supplierOrg.id,
                    isDeleted: false,
                    clientLE: { isDeleted: false, status: { not: "ARCHIVED" } },
                },
                include: {
                    clientLE: { select: { id: true, name: true } },
                },
            });

            const childNodes: PermissionNode[] = [];
            for (const eng of engagements) {
                const explicitEngRole = engRoleMap.get(eng.id) || null;

                // Engagements are included if user has explicit engagement membership OR if user belongs to Supplier Org (structural)
                if (explicitEngRole || explicitOrgRole) {
                    childNodes.push({
                        id: eng.id,
                        name: eng.clientLE.name,
                        type: "LE",
                        href: `/app/s/${supplierOrg.id}/engagements/${eng.id}`,
                        permissionLabel: explicitEngRole || "—",
                    });
                }
            }

            childNodes.sort((a, b) => a.name.localeCompare(b.name));

            if (explicitOrgRole || childNodes.length > 0) {
                supplierNodes.push({
                    id: supplierOrg.id,
                    name: supplierOrg.name,
                    type: "SUPPLIER",
                    href: `/app/s/${supplierOrg.id}`,
                    permissionLabel: explicitOrgRole || "—",
                    children: childNodes,
                });
            }
        }

        // --- 3. OTHER ORGANIZATIONS ---
        const otherNodes: PermissionNode[] = [];
        memberships.forEach((m: any) => {
            if (m.organizationId && m.organization && !m.clientLEId && !m.fiEngagementId) {
                const types = m.organization.types || [];
                const isClient = types.includes("CLIENT");
                const isSupplier = types.includes("FI") || types.includes("SUPPLIER");

                if (!isClient && !isSupplier) {
                    const orgType = types.includes("LAW_FIRM") ? "LAW_FIRM" : types.includes("SYSTEM") ? "SYSTEM" : "OTHER";
                    otherNodes.push({
                        id: m.organization.id,
                        name: m.organization.name,
                        type: orgType,
                        href: `/app/admin/organizations/${m.organization.id}`,
                        permissionLabel: m.role,
                        children: [],
                    });
                }
            }
        });

        otherNodes.sort((a, b) => a.name.localeCompare(b.name));

        return {
            success: true as const,
            data: {
                clients: clientNodes,
                suppliers: supplierNodes,
                others: otherNodes,
            },
        };
    } catch (error) {
        console.error("[getUserPermissions] Error:", error);
        return { success: false, error: "Failed to fetch permissions" };
    }
}
