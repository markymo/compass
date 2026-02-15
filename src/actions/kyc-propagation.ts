"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { QuestionStatus } from "@prisma/client";

export async function applyMasterToQuestion(
    questionId: string,
    masterValue: any,
    userId: string, // In a real app, this might come from session context
    path?: string
) {
    try {
        if (!questionId) throw new Error("Question ID is required");

        // 1. Format the value for the answer
        // If it's a complex object (like a group), stringify it?
        // For now, assume simple string or simple object that can be stringified.
        let answerText = "";
        if (typeof masterValue === 'object' && masterValue !== null) {
            answerText = JSON.stringify(masterValue, null, 2);
        } else {
            answerText = String(masterValue);
        }

        // 2. Update the Question
        const updatedQuestion = await prisma.question.update({
            where: { id: questionId },
            data: {
                answer: answerText,
                status: QuestionStatus.DRAFT
            }
        });

        // 3. Log Activity
        await prisma.questionActivity.create({
            data: {
                questionId: questionId,
                userId: userId,
                type: 'MASTER_DATA_PROPAGATION', // We might need to add this to the Enum or use string if not strict
                details: {
                    value: masterValue,
                    action: "ACCEPTED_GOLDEN_RECORD"
                }
            }
        });

        // 4. Revalidate if path provided
        if (path) {
            revalidatePath(path);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Failed to propagate master data:", error);
        return { success: false, error: error.message };
    }
}
