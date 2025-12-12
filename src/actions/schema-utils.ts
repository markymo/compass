"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function getMasterSchemaFields() {
    const activeSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true }
    });

    if (!activeSchema) return [];
    return (activeSchema.definition as any).fields || [];
}
