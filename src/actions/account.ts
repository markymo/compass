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
                    notificationPrefs: { ...(user?.notificationPrefs as any || {}), ...(data.notificationPrefs) }
                }),
                // @ts-ignore
                ...(data.preferences !== undefined && {
                    preferences: { ...(user?.preferences as any || {}), ...(data.preferences) }
                }),
            },
        });

        revalidatePath("/app/account");
        return { success: true };
    } catch (e) {
        console.error("[updateAccountSettings] Error:", e);
        return { success: false, error: "An error occurred while saving your settings." };
    }
}

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
                        owners: {
                            where: { endAt: null },
                            select: { party: { select: { id: true, name: true } } },
                            take: 1,
                        },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const rows = memberships.map((m) => {
            if (m.organization) {
                let scopeLabel = "Organization";
                let priority = 4;

                if (m.organization.types?.includes("CLIENT" as any)) {
                    scopeLabel = "Client";
                    priority = 1;
                } else if (m.organization.types?.includes("FI" as any)) {
                    scopeLabel = "Financial Institution";
                    priority = 3;
                }

                return {
                    id: m.id,
                    scope: scopeLabel,
                    priority,
                    name: m.organization.name,
                    href: `/app/clients/${m.organization.id}`,
                    role: m.role,
                };
            }
            if (m.clientLE) {
                const ownerName = m.clientLE.owners[0]?.party?.name ?? null;
                return {
                    id: m.id,
                    scope: "Legal Entity" as const,
                    priority: 2,
                    name: m.clientLE.name,
                    parentName: ownerName,
                    href: `/app/le/${m.clientLE.id}`,
                    role: m.role,
                };
            }
            return null;
        }).filter((r): r is NonNullable<typeof r> => r !== null);

        rows.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.name.localeCompare(b.name);
        });

        return { success: true as const, data: rows };
    } catch (error) {
        console.error("[getUserPermissions] Error:", error);
        return { success: false, error: "Failed to fetch permissions" };
    }
}
