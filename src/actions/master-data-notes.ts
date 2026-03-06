"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function saveMasterFieldNote(clientLEId: string, fieldNo: number, text: string) {
    const identity = await getIdentity();
    if (!identity || !identity.userId) throw new Error("Unauthorized");

    const userId = identity.userId;

    // Manual SQL Upsert fallback
    await prisma.$executeRaw`
        INSERT INTO master_field_notes ("id", "clientLEId", "fieldNo", "text", "createdByUserId", "createdAt", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${clientLEId}, ${fieldNo}, ${text}, ${userId}, NOW(), NOW())
        ON CONFLICT ("clientLEId", "fieldNo") 
        DO UPDATE SET "text" = ${text}, "updatedAt" = NOW()
    `;

    revalidatePath(`/app/le/${clientLEId}`);
    return { success: true };
}
