"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { QuestionStatus } from "@prisma/client";
import { ensureQuestionNotReferenceSnapshot } from "./questionnaire";
import { getFieldDetail } from "./kyc-query";
import { toExportText } from "@/lib/export/toExportText";
import { resolveFieldForDisplay } from "@/lib/master-data/field-interpreter";

export async function applyMasterToQuestion(
    questionId: string,
    masterValue: any,
    userId: string, // In a real app, this might come from session context
    path?: string
) {
    try {
        if (!questionId) throw new Error("Question ID is required");
        await ensureQuestionNotReferenceSnapshot(questionId);

        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                questionnaire: {
                    include: { engagements: true, fiEngagement: true }
                }
            }
        });
        if (!question) throw new Error("Question not found");

        const clientLEId = question.questionnaire?.fiEngagement?.clientLEId || question.questionnaire?.engagements?.[0]?.clientLEId;
        
        let answerText = "";
        if (clientLEId && question.masterFieldNo) {
            const fieldDetail = await getFieldDetail(clientLEId, question.masterFieldNo, "CLIENT_LE");
            const displayModel = resolveFieldForDisplay(masterValue, null, {
                fieldNo: question.masterFieldNo,
                label: "Propagated Field",
                displayState: "HAS_VALUE",
                appDataType: fieldDetail.dataType,
                profileConfig: fieldDetail.profileConfig
            });
            answerText = toExportText(displayModel);
        } else {
            const displayModel = resolveFieldForDisplay(masterValue, null, {
                fieldNo: -1,
                label: "Unmapped Propagated Field",
                displayState: "HAS_VALUE"
            });
            answerText = toExportText(displayModel);
        }

        // 2. Update the Question
        const updatedQuestion = await prisma.question.update({
            where: { id: questionId },
            data: {
                answer: answerText,
                status: 'DRAFT'
            },
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
