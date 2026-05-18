"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/actions/admin";
import { revalidatePath } from "next/cache";

/**
 * Assign or clear a question's master field mapping.
 * Pass null to clear (unmap) the question.
 * Clearing masterFieldNo also preserves any masterQuestionGroupId.
 * Setting masterFieldNo clears masterQuestionGroupId (they are mutually exclusive).
 */
export async function assignQuestionToMasterField(
    questionId: string,
    masterFieldNo: number | null
): Promise<{ success: boolean; error?: string }> {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        await prisma.question.update({
            where: { id: questionId },
            data: {
                masterFieldNo: masterFieldNo,
                // If assigning a master field, clear group mapping (mutually exclusive)
                ...(masterFieldNo !== null ? { masterQuestionGroupId: null } : {}),
            },
        });

        // Revalidate the admin mapping workbench pages
        revalidatePath("/app/admin/mapping-workbench-2");
        revalidatePath("/app/admin/mapping-workbench");

        return { success: true };
    } catch (error: any) {
        console.error("assignQuestionToMasterField error:", error);
        return { success: false, error: error.message };
    }
}
