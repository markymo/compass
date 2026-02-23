"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getAccountSettings() {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    const user = await prisma.user.findUnique({
        where: { id: identity.userId },
        select: {
            id: true,
            email: true,
            name: true,
            // @ts-ignore: Prisma client cache lag
            jobTitle: true,
            // @ts-ignore
            phone: true,
            // @ts-ignore
            notificationPrefs: true,
        },
    });

    if (!user) {
        return { success: false, error: "User not found" };
    }

    // Determine auth type implicitly (e.g. if they have a password set)
    // For V1, we'll fetch accounts
    const accounts = await prisma.account.findMany({
        where: { userId: identity.userId }
    });

    const dbUserHasPassword = await prisma.user.findUnique({
        where: { id: identity.userId },
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
}

export async function updateAccountSettings(data: {
    name?: string;
    jobTitle?: string;
    phone?: string;
    notificationPrefs?: any;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const updatedUser = await prisma.user.update({
            where: { id: identity.userId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                // @ts-ignore: Prisma client cache lag
                ...(data.jobTitle !== undefined && { jobTitle: data.jobTitle }),
                // @ts-ignore
                ...(data.phone !== undefined && { phone: data.phone }),
                // @ts-ignore
                ...(data.notificationPrefs !== undefined && { notificationPrefs: data.notificationPrefs }),
            },
        });

        revalidatePath("/app/account");

        return { success: true };
    } catch (e) {
        console.error("Failed to update account settings:", e);
        return { success: false, error: "An error occurred while saving your settings." };
    }
}
export async function getUserPermissions() {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false as const, error: "Unauthorized" };

    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId },
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

            if (m.organization.types.includes("CLIENT" as any)) {
                scopeLabel = "Client";
                priority = 1;
            } else if (m.organization.types.includes("FI" as any)) {
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

    // Sort by priority (1: Client, 2: LE, 3: FI, 4: Other) then Name
    rows.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.name.localeCompare(b.name);
    });

    return { success: true as const, data: rows };
}
