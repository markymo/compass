import prisma from "@/lib/prisma";

export async function logAudit(data: {
    userId: string;
    action: string;
    entityId?: string;
    details?: any;
}) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entityId: data.entityId,
                details: data.details
            }
        });
    } catch (error) {
        console.error("Failed to write audit log:", error);
        // We generally don't want audit failure to block the main action, 
        // but for high security it might be required. For now, just log error.
    }
}
