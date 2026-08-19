"use server";

import { getIdentity } from "@/lib/auth";
import { getActorContext } from "@/lib/auth/actor-context";
import { can, Action } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";
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

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.ENG_SIGNOFF_RESPONSES, { engagementId: params.relationshipId }, prisma);
    if (!hasAccess) {
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

    if (!params.relationshipId) {
        return { success: false, error: "Unauthorized" };
    }

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.ENG_VIEW_RELEASED_DATA, { engagementId: params.relationshipId }, prisma);
    if (!hasAccess) {
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
        const subMeta = await prisma.questionnaireSubmission.findUnique({
            where: { id: submissionId },
            select: { relationshipId: true }
        });
        if (!subMeta) {
            return { success: false, error: "Unauthorized" };
        }

        const actor = await getActorContext(identity.userId);
        const hasAccess = await can(actor, Action.ENG_VIEW_RELEASED_DATA, { engagementId: subMeta.relationshipId }, prisma);
        if (!hasAccess) {
            return { success: false, error: "Unauthorized" };
        }

        const submission = await getSubmissionById(submissionId);
        if (!submission) {
            return { success: false, error: "Unauthorized" };
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

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.LE_VIEW_MASTER_DATA, { clientLEId }, prisma);
    if (!hasAccess) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId, isDeleted: false },
            include: { org: { select: { id: true, name: true } } },
            orderBy: { org: { name: 'asc' } }
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

export async function getQuestionnairesForRelationshipAction(params: {
    relationshipId: string;
    clientLEId: string;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, error: "Unauthorized" };
    }

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.ENG_VIEW_RELEASED_DATA, { engagementId: params.relationshipId }, prisma);
    if (!hasAccess) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // 1. Fetch relationship-specific questionnaires
        const relationshipQs = await prisma.questionnaire.findMany({
            where: { fiEngagementId: params.relationshipId, isDeleted: false, isTemplate: false },
            select: { id: true, name: true, referenceCode: true, kind: true, _count: { select: { questions: true } } }
        });

        // 2. Fetch Common Questionnaires linked to Client Legal Entity
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: params.clientLEId },
            select: {
                commonQuestionnaires: {
                    where: { isDeleted: false, isTemplate: false },
                    select: { id: true, name: true, referenceCode: true, kind: true, _count: { select: { questions: true } } }
                }
            }
        });

        const commonQs = clientLE?.commonQuestionnaires || [];

        // Combine unique questionnaires
        const map = new Map<string, any>();
        for (const q of [...relationshipQs, ...commonQs]) {
            map.set(q.id, {
                id: q.id,
                name: q.name,
                referenceCode: q.referenceCode || null,
                isCommon: q.kind === "COMMON_QUESTIONNAIRE",
                questionCount: q._count?.questions || 0
            });
        }

        return { success: true, data: Array.from(map.values()) };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to load questionnaires." };
    }
}

export async function getApprovalHistoryForLEAction(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, error: "Unauthorized" };
    }

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.LE_VIEW_MASTER_DATA, { clientLEId }, prisma);
    if (!hasAccess) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const submissions = await prisma.questionnaireSubmission.findMany({
            where: { clientLEId },
            orderBy: { submittedAt: 'desc' },
            include: {
                questionnaire: { select: { id: true, name: true, referenceCode: true, kind: true } },
                definitionVersion: { select: { versionNumber: true, questionCount: true } },
                relationship: { include: { org: { select: { id: true, name: true } } } },
                submittedBy: { select: { id: true, name: true, email: true } },
                answers: { select: { id: true } }
            }
        });

        return { success: true, data: JSON.parse(JSON.stringify(submissions)) };
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to load approval history." };
    }
}

export async function submitMultipleQuestionnairesAction(params: {
    questionnaireIds: string[];
    relationshipId: string;
    clientLEId: string;
}) {
    const identity = await getIdentity();
    if (!identity?.userId) {
        return { success: false, error: "Unauthorized" };
    }

    const actor = await getActorContext(identity.userId);
    const hasAccess = await can(actor, Action.ENG_SIGNOFF_RESPONSES, { engagementId: params.relationshipId }, prisma);
    if (!hasAccess) {
        return { success: false, error: "Unauthorized" };
    }

    if (!params.questionnaireIds || params.questionnaireIds.length === 0) {
        return { success: false, error: "No questionnaires selected for approval." };
    }

    const results = [];
    const errors = [];

    for (const qId of params.questionnaireIds) {
        const input: CreateSubmissionInput = {
            questionnaireId: qId,
            relationshipId: params.relationshipId,
            clientLEId: params.clientLEId,
            submittedById: identity.userId,
        };

        const res = await createQuestionnaireSubmission(input);
        if (res.success) {
            results.push(res);
        } else {
            errors.push({ questionnaireId: qId, error: res.error });
        }
    }

    revalidatePath(`/app/le/${params.clientLEId}`);
    revalidatePath(`/app/le/${params.clientLEId}/approvals`);
    revalidatePath(`/app/le/${params.clientLEId}/relationships`);
    revalidatePath(`/app/s/${params.relationshipId}`);

    if (results.length > 0) {
        return {
            success: true,
            approvedCount: results.length,
            errors: errors.length > 0 ? errors : undefined
        };
    } else {
        return {
            success: false,
            error: errors[0]?.error || "Failed to create approvals."
        };
    }
}


