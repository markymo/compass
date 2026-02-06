"use server";

import prisma from "@/lib/prisma";
// Auth import removed

export async function getMasterSchemaFields() {
    const activeSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true }
    });

    if (!activeSchema) return [];
    return (activeSchema.definition as any).fields || [];
}
