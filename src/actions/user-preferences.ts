"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

export async function getUserPreferences() {
    const identity = await getIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };

    try {
        const user = await (prisma.user as any).findUnique({
            where: { id: identity.userId },
            select: { preferences: true }
        });

        const prefs = (user?.preferences as any) || {};
        console.log(`Fetched preferences for ${identity.userId}:`, prefs);

        return {
            success: true,
            preferences: prefs
        };
    } catch (error) {
        console.error("Failed to fetch user preferences:", error);
        return { success: false, error: "Database error" };
    }
}

export async function updateUserPreferences(newPrefs: any) {
    const identity = await getIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };

    try {
        const user = await (prisma.user as any).findUnique({
            where: { id: identity.userId },
            select: { preferences: true }
        });

        const currentPrefs = (user?.preferences as any) || {};
        const updatedPrefs = { ...currentPrefs, ...newPrefs };
        console.log(`Updating preferences for ${identity.userId}:`, updatedPrefs);

        await (prisma.user as any).update({
            where: { id: identity.userId },
            data: { preferences: updatedPrefs }
        });

        return { success: true, preferences: updatedPrefs };
    } catch (error) {
        console.error("Failed to update user preferences:", error);
        return { success: false, error: "Database error" };
    }
}
