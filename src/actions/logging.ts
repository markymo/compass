"use server"

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** Resolve environment tag from server-side env var. Domain-agnostic. */
const APP_ENV = process.env.APP_ENV || (process.env.NODE_ENV === "production" ? "production" : "local");

/**
 * Log an authenticated user activity.
 * Safe to call from Client Components (via this Server Action) or Server Components.
 */
export async function logActivity(action: string, path: string, details?: any) {
    try {
        const identity = await getIdentity();
        // We only track authenticated users per requirements
        if (!identity?.userId) return;
        const { userId } = identity;

        await prisma.usageLog.create({
            data: {
                userId,
                action,
                path,
                details: details || {},
                env: APP_ENV,
            }
        });
    } catch (e) {
        console.error("Failed to log activity:", e);
        // Fail silently to not block user flow
    }
}

/**
 * Log activity when userId is already known (e.g. from auth callbacks
 * where getIdentity() isn't available).
 */
export async function logActivityDirect(userId: string, action: string, path?: string, details?: any) {
    try {
        await prisma.usageLog.create({
            data: {
                userId,
                action,
                path: path || null,
                details: details || {},
                env: APP_ENV,
            }
        });
    } catch (e) {
        console.error("Failed to log activity (direct):", e);
    }
}
