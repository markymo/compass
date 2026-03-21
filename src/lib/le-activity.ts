import prisma from "@/lib/prisma";
import {
    LEActivityType,
    LEActivityTypeValue,
    ACTIVITY_META
} from "./le-activity-schema";

export { LEActivityType, ACTIVITY_META };
export type { LEActivityTypeValue };

// ============================================================================
// recordActivity — fire-and-forget. Never blocks the calling action.
// ============================================================================

export async function recordActivity(
    leId: string,
    userId: string,
    type: LEActivityTypeValue,
    details?: Record<string, any>
) {
    try {
        // @ts-ignore: Prisma cache lag — new model
        await (prisma.lEActivity?.create ?? (prisma as any).lEActivity.create)({
            data: { leId, userId, type, details: details ?? undefined }
        });
    } catch (err) {
        // Never let activity logging break the main action
        console.error("[recordActivity] Failed:", err);
    }
}

// ============================================================================
// getRecentLEActivity — server-side fetch for the UI
// ============================================================================

export async function getRecentLEActivity(leId: string, limit = 20) {
    try {
        // @ts-ignore: Prisma cache lag — new model
        const activities = await (prisma.lEActivity as any).findMany({
            where: { leId },
            include: {
                user: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return activities as Array<{
            id: string;
            leId: string;
            userId: string;
            type: LEActivityTypeValue;
            details: Record<string, any> | null;
            createdAt: Date;
            user: { id: string; name: string | null; email: string };
        }>;
    } catch (err) {
        console.error("[getRecentLEActivity] Failed:", err);
        return [];
    }
}
