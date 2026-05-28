/**
 * source-priority-service.server.ts
 *
 * Server-only runtime loader for the source priority config.
 * ⚠️  Do NOT import this from client components — it uses prisma.
 *
 * Use source-priority-config.ts for pure constants (client-safe).
 */

import prisma from "@/lib/prisma";
import { CODE_DEFAULTS, SYSTEM_SETTING_KEY } from "./source-priority-config";

/**
 * Returns the effective priority table, merging DB overrides onto code defaults.
 * Falls back silently to CODE_DEFAULTS if the DB row is absent or unreadable.
 *
 * Call once per request — not per-claim.
 */
export async function getSourcePriorityConfig(): Promise<Record<string, number>> {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: SYSTEM_SETTING_KEY },
        });
        if (setting?.value && typeof setting.value === "object") {
            // DB values override code defaults; code defaults fill any gaps
            return { ...CODE_DEFAULTS, ...(setting.value as Record<string, number>) };
        }
    } catch (e) {
        console.warn("[source-priority-service] Failed to load DB overrides, using code defaults:", e);
    }
    return { ...CODE_DEFAULTS };
}
