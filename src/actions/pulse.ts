"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { checkIsSystemAdmin } from "@/actions/client";

// ============================================================================
// Pulse Dashboard — Server Actions (System Admin Only)
// ============================================================================

const APP_ENV = process.env.APP_ENV || (process.env.NODE_ENV === "production" ? "production" : "local");

/**
 * Get the Pulse dashboard data for the last N days.
 * System admin only.
 */
export async function getPulseData(options?: { days?: number; includeAllEnvs?: boolean }) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    const isSysAdmin = await checkIsSystemAdmin(identity.userId);
    if (!isSysAdmin) return { success: false, error: "System admin access required" };

    const days = options?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Environment filter: default to production only, unless toggled
    const envFilter = options?.includeAllEnvs ? {} : { env: "production" };

    try {
        // ====================================================================
        // Section A: User Activity Summary
        // ====================================================================
        const logs = await prisma.usageLog.findMany({
            where: {
                createdAt: { gte: since },
                ...envFilter,
            },
            select: {
                userId: true,
                action: true,
                path: true,
                env: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Build per-user stats
        const userStatsMap = new Map<string, {
            userId: string;
            totalActions: number;
            lastActive: Date;
            loginCount: number;
            actionBreakdown: Record<string, number>;
            topPage: string;
        }>();

        const pageCounts = new Map<string, Map<string, number>>(); // userId -> page -> count

        for (const log of logs) {
            const existing = userStatsMap.get(log.userId);
            if (!existing) {
                userStatsMap.set(log.userId, {
                    userId: log.userId,
                    totalActions: 1,
                    lastActive: log.createdAt,
                    loginCount: log.action === "LOGIN" ? 1 : 0,
                    actionBreakdown: { [log.action]: 1 },
                    topPage: log.path || "",
                });
                pageCounts.set(log.userId, new Map([[log.path || "", 1]]));
            } else {
                existing.totalActions++;
                if (log.createdAt > existing.lastActive) existing.lastActive = log.createdAt;
                if (log.action === "LOGIN") existing.loginCount++;
                existing.actionBreakdown[log.action] = (existing.actionBreakdown[log.action] || 0) + 1;

                const pc = pageCounts.get(log.userId)!;
                pc.set(log.path || "", (pc.get(log.path || "") || 0) + 1);
            }
        }

        // Resolve top page for each user
        for (const [userId, pc] of pageCounts) {
            const stats = userStatsMap.get(userId)!;
            let maxCount = 0;
            let topPage = "";
            for (const [page, count] of pc) {
                if (count > maxCount && page) {
                    maxCount = count;
                    topPage = page;
                }
            }
            stats.topPage = topPage;
        }

        // Fetch user details for all user IDs
        const userIds = Array.from(userStatsMap.keys());
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                name: true,
                email: true,
                isDemoActor: true,
                memberships: {
                    include: {
                        organization: { select: { name: true } },
                    },
                    take: 1,
                },
            },
        });

        const userLookup = new Map(users.map(u => [u.id, u]));

        const userActivity = Array.from(userStatsMap.values())
            .map(stats => {
                const user = userLookup.get(stats.userId);
                return {
                    userId: stats.userId,
                    name: user?.name || "Unknown",
                    email: user?.email || "unknown",
                    isDemoActor: user?.isDemoActor || false,
                    orgName: user?.memberships[0]?.organization?.name || "—",
                    totalActions: stats.totalActions,
                    loginCount: stats.loginCount,
                    lastActive: stats.lastActive,
                    topPage: stats.topPage,
                    actionBreakdown: stats.actionBreakdown,
                };
            })
            .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());

        // ====================================================================
        // Section B: Daily Action Summary (for trend chart)
        // ====================================================================
        const dailyMap = new Map<string, Record<string, number>>();
        for (const log of logs) {
            const day = log.createdAt.toISOString().slice(0, 10);
            if (!dailyMap.has(day)) dailyMap.set(day, {});
            const dayStats = dailyMap.get(day)!;
            dayStats[log.action] = (dayStats[log.action] || 0) + 1;
            dayStats._total = (dayStats._total || 0) + 1;
        }

        const dailyTrend = Array.from(dailyMap.entries())
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // ====================================================================
        // Section C: Per-LE Engagement Health
        // ====================================================================
        const activeLEs = await prisma.clientLE.findMany({
            where: { isDeleted: false, status: { not: "ARCHIVED" } },
            select: {
                id: true,
                name: true,
                owners: {
                    where: { endAt: null },
                    include: { party: { select: { name: true } } },
                    take: 1,
                },
                memberships: {
                    select: { userId: true },
                },
            },
        });

        // Fetch LE-scoped activity from LEActivity table
        const leActivities = await prisma.lEActivity.findMany({
            where: {
                createdAt: { gte: since },
                leId: { in: activeLEs.map(le => le.id) },
            },
            select: {
                leId: true,
                userId: true,
                type: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        const leActivityMap = new Map<string, {
            lastActivity: Date | null;
            activeUsers: Set<string>;
            questionsAnswered: number;
            totalEvents: number;
        }>();

        for (const le of activeLEs) {
            leActivityMap.set(le.id, {
                lastActivity: null,
                activeUsers: new Set(),
                questionsAnswered: 0,
                totalEvents: 0,
            });
        }

        for (const activity of leActivities) {
            const stats = leActivityMap.get(activity.leId);
            if (!stats) continue;
            stats.totalEvents++;
            stats.activeUsers.add(activity.userId);
            if (!stats.lastActivity || activity.createdAt > stats.lastActivity) {
                stats.lastActivity = activity.createdAt;
            }
            if (activity.type === "QUESTION_ANSWERED") {
                stats.questionsAnswered++;
            }
        }

        const leHealth = activeLEs.map(le => {
            const stats = leActivityMap.get(le.id)!;
            const daysSinceActivity = stats.lastActivity
                ? Math.floor((Date.now() - stats.lastActivity.getTime()) / (1000 * 60 * 60 * 24))
                : null;

            return {
                id: le.id,
                name: le.name,
                ownerOrg: le.owners[0]?.party?.name || "—",
                teamSize: le.memberships.length,
                lastActivity: stats.lastActivity,
                daysSinceActivity,
                activeUsers: stats.activeUsers.size,
                questionsAnswered: stats.questionsAnswered,
                totalEvents: stats.totalEvents,
                status: daysSinceActivity === null
                    ? "no_activity"
                    : daysSinceActivity <= 3
                        ? "active"
                        : daysSinceActivity <= 7
                            ? "cooling"
                            : "cold",
            };
        }).sort((a, b) => {
            // Sort: cold first (most concerning), then cooling, then active
            const statusOrder = { no_activity: 0, cold: 1, cooling: 2, active: 3 };
            return (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0);
        });

        // ====================================================================
        // Summary stats
        // ====================================================================
        const totalLogins = logs.filter(l => l.action === "LOGIN").length;
        const uniqueUsers = new Set(logs.map(l => l.userId)).size;
        const totalActions = logs.length;

        return {
            success: true,
            data: {
                summary: {
                    totalLogins,
                    uniqueUsers,
                    totalActions,
                    period: `Last ${days} days`,
                    env: options?.includeAllEnvs ? "all" : "production",
                },
                userActivity,
                dailyTrend,
                leHealth,
            },
        };
    } catch (e) {
        console.error("[getPulseData] Error:", e);
        return { success: false, error: "Failed to fetch pulse data" };
    }
}
