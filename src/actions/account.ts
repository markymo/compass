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
