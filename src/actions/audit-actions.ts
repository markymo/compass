"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

export async function getAuditHistory(entityType: string, entityId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                entityType,
                entityId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 50,
        });

        // We can fetch user details if needed, but for minimal implementation we just return the logs
        return { success: true, logs };
    } catch (e: any) {
        console.error("getAuditHistory error:", e);
        return { success: false, error: e.message || String(e) };
    }
}
