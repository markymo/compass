"use server"

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * Log an authenticated user activity.
 * Safe to call from Client Components (via this Server Action) or Server Components.
 */
export async function logActivity(action: string, path: string, details?: any) {
    try {
        const { userId } = await auth();
        // We only track authenticated users per requirements
        if (!userId) return;

        await prisma.usageLog.create({
            data: {
                userId,
                action,
                path,
                details: details || {}
            }
        });
    } catch (e) {
        console.error("Failed to log activity:", e);
        // Fail silently to not block user flow
    }
}
