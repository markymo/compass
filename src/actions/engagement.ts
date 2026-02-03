"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Updates the list of Questionnaires connected to an Engagement.
 * This effectively sets "Which forms does this Client need to complete for this FI?"
 */
export async function manageEngagementQuestionnaires(engagementId: string, questionnaireIds: string[]) {
    try {
        // We use 'set' to replace existing relations if using implicit many-to-many
        // Or we can disconnect all and connect new ones.

        await prisma.fIEngagement.update({
            where: { id: engagementId },
            data: {
                questionnaires: {
                    set: questionnaireIds.map(id => ({ id }))
                }
            }
        });

        // Revalidate relevant paths
        // We don't know the exact paths easily without looking up fetched data, 
        // but typically this is called from an FI Dashboard or Client Dashboard.
        revalidatePath(`/app/engagements/${engagementId}`);
        revalidatePath(`/app/le`);

        return { success: true };
    } catch (error) {
        console.error("Failed to update engagement questionnaires:", error);
        return { success: false, error: "Database update failed" };
    }
}

export async function createEngagement(fiOrgId: string, clientLEId: string) {
    try {
        const engagement = await prisma.fIEngagement.create({
            data: {
                fiOrgId,
                clientLEId,
                status: "INVITED"
            }
        });
        return { success: true, data: engagement };
    } catch (error) {
        // Likely unique constraint violation
        console.error("Create engagement error:", error);
        return { success: false, error: "Likely already exists" };
    }
}
