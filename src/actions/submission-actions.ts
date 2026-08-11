"use server";

import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
    createQuestionnaireSubmission,
    getLatestSubmissionForRelationship,
    getSubmissionHistoryForRelationship,
    getSubmissionById,
    CreateSubmissionInput
} from "@/services/submissionService";

export async function submitQuestionnaireAction(params: {
    questionnaireId: string;
    relationshipId: string;
    clientLEId: string;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, error: "Unauthorized" };
    }

    const input: CreateSubmissionInput = {
        questionnaireId: params.questionnaireId,
        relationshipId: params.relationshipId,
        clientLEId: params.clientLEId,
        submittedById: identity.userId,
    };

    const result = await createQuestionnaireSubmission(input);

    if (result.success) {
        revalidatePath(`/app/le/${params.clientLEId}`);
        revalidatePath(`/app/s/${params.relationshipId}`);
    }

    return result;
}

export async function getSubmissionHistoryAction(params: {
    questionnaireId: string;
    relationshipId?: string;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const history = await getSubmissionHistoryForRelationship(
            params.questionnaireId,
            params.relationshipId
        );
        return { success: true, data: JSON.parse(JSON.stringify(history)) };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to load submission history." };
    }
}

export async function getSubmissionDetailAction(submissionId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const submission = await getSubmissionById(submissionId);
        if (!submission) {
            return { success: false, error: "Submission not found." };
        }
        return { success: true, data: JSON.parse(JSON.stringify(submission)) };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to load submission detail." };
    }
}

export async function getRelationshipsForLEAction(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const prisma = (await import("@/lib/prisma")).default;
        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId, isDeleted: false },
            include: { org: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' }
        });
        return {
            success: true,
            data: engagements.map((e: any) => ({
                id: e.id,
                orgName: e.org.name,
                status: e.status
            }))
        };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to load relationships." };
    }
}

