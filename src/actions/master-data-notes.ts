"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActionDomainError, handleActionError } from "@/lib/action-error-handler";

export async function saveMasterFieldNote(clientLEId: string, fieldNo: number, text: string) {
    try {
        const identity = await getIdentity();
        if (!identity || !identity.userId) {
            throw new ActionDomainError("Unauthorized");
        }

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
    } catch (error: any) {
        return handleActionError(error, {
            operation: "Save Master field note",
            fallbackMessage: "We couldn’t save this note.",
            context: { clientLEId, fieldNo }
        });
    }
}
