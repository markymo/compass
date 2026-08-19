import prisma from "@/lib/prisma";
import { KycStateService, DerivedValue } from "@/lib/kyc/KycStateService";
import {
    QuestionStateMetrics,
    emptyQuestionStateMetrics,
    rollupQuestionStateMetrics,
    classifyQuestionAnswerState,
    QuestionAnswerCategory,
} from "./question-state-types";

export {
    type QuestionStateMetrics,
    emptyQuestionStateMetrics,
    rollupQuestionStateMetrics,
    classifyQuestionAnswerState,
    type QuestionAnswerCategory,
};

/**
 * Resolves answer provenance for a list of questionnaire questions using KycStateService.resolveAllFields
 * and computes exact QuestionStateMetrics.
 * Enforces invariant: total = external + userInput + defaultResponse + unanswered.
 */
export async function calculateQuestionStateMetricsForQuestions(
    questions: Array<{
        id: string;
        answer: string | null;
        masterFieldNo: number | null;
        masterQuestionGroupId: string | null;
        customFieldDefinitionId: string | null;
        questionnaireId?: string | null;
    }>,
    legalEntityId?: string | null,
    customData?: any,
    clientLeId?: string | null
): Promise<QuestionStateMetrics> {
    const m = emptyQuestionStateMetrics();
    if (!questions || questions.length === 0) return m;

    const uniqueQIds = new Set<string>(
        questions.filter((q) => q.questionnaireId).map((q) => q.questionnaireId!)
    );
    m.questionnairesCount = uniqueQIds.size;

    let ownerScopeId: string | null = null;
    if (clientLeId) {
        ownerScopeId = await KycStateService.resolveScopeId(clientLeId).catch(() => null);
    }

    // 1. Gather all masterFieldNos directly on questions
    const masterFieldNos = new Set<number>(
        questions.filter((q) => q.masterFieldNo !== null).map((q) => q.masterFieldNo!)
    );

    // 2. Gather group sub-fields for questions mapped to masterQuestionGroupId
    const groupKeys = Array.from(
        new Set(questions.filter((q) => q.masterQuestionGroupId !== null).map((q) => q.masterQuestionGroupId!))
    );

    const groupFieldMap = new Map<string, number[]>();
    if (groupKeys.length > 0) {
        const groupItems = await prisma.masterFieldGroupItem.findMany({
            where: {
                OR: [
                    { groupId: { in: groupKeys } },
                    { group: { key: { in: groupKeys } } }
                ]
            },
            select: { groupId: true, fieldNo: true, group: { select: { key: true } } }
        });
        for (const item of groupItems) {
            if (item.groupId) {
                if (!groupFieldMap.has(item.groupId)) groupFieldMap.set(item.groupId, []);
                groupFieldMap.get(item.groupId)!.push(item.fieldNo);
                masterFieldNos.add(item.fieldNo);
            }
            if (item.group?.key) {
                if (!groupFieldMap.has(item.group.key)) groupFieldMap.set(item.group.key, []);
                groupFieldMap.get(item.group.key)!.push(item.fieldNo);
                masterFieldNos.add(item.fieldNo);
            }
        }
    }

    // 3. Resolve all master fields (including group sub-fields) in batch
    let resolvedMap = new Map<number, DerivedValue | DerivedValue[] | null>();
    if (legalEntityId && masterFieldNos.size > 0) {
        const fieldDefs = Array.from(masterFieldNos).map((no: number) => ({ fieldNo: no, isMultiValue: true }));
        resolvedMap = await KycStateService.resolveAllFields(
            { subjectLeId: legalEntityId, clientLEId: clientLeId || undefined },
            fieldDefs,
            ownerScopeId || undefined
        ).catch(() => new Map());
    }

    // Helper to extract winning claim from resolvedMap for a fieldNo
    const extractDerivedValue = (fNo: number): { hasVal: boolean; sourceType: string | null; isScoped: boolean; evidenceProvider: string | null; displayState: string | null } => {
        if (!resolvedMap.has(fNo)) return { hasVal: false, sourceType: null, isScoped: false, evidenceProvider: null, displayState: null };
        const val = resolvedMap.get(fNo);
        if (val === null || val === undefined) return { hasVal: false, sourceType: null, isScoped: false, evidenceProvider: null, displayState: null };

        if (Array.isArray(val) && val.length > 0) {
            const primary = val[0];
            return {
                hasVal: true,
                sourceType: primary.sourceType || null,
                isScoped: Boolean(primary.isScoped),
                evidenceProvider: primary.evidenceProvider || null,
                displayState: null,
            };
        } else if (!Array.isArray(val)) {
            if (val.value !== null && val.value !== undefined && val.value !== "") {
                return {
                    hasVal: true,
                    sourceType: val.sourceType || null,
                    isScoped: Boolean(val.isScoped),
                    evidenceProvider: val.evidenceProvider || null,
                    displayState: null,
                };
            }
            if (val.value && typeof val.value === "object" && (val.value as any).explicitNone === true) {
                return {
                    hasVal: true,
                    sourceType: val.sourceType || null,
                    isScoped: Boolean(val.isScoped),
                    evidenceProvider: val.evidenceProvider || null,
                    displayState: null,
                };
            }
        }
        return { hasVal: false, sourceType: null, isScoped: false, evidenceProvider: null, displayState: null };
    };

    // 4. Classify each question
    for (const q of questions) {
        m.total++;

        let hasAnswer = false;
        let sourceType: string | null = null;
        let isScoped = false;
        let evidenceProvider: string | null = null;
        let displayState: string | null = null;

        // A. Single Master Field
        if (q.masterFieldNo !== null) {
            const res = extractDerivedValue(q.masterFieldNo);
            if (res.hasVal) {
                hasAnswer = true;
                sourceType = res.sourceType;
                isScoped = res.isScoped;
                evidenceProvider = res.evidenceProvider;
                displayState = res.displayState;
            }
        }

        // B. Master Field Group
        if (!hasAnswer && q.masterQuestionGroupId !== null) {
            const subFieldNos = groupFieldMap.get(q.masterQuestionGroupId) || [];
            for (const fNo of subFieldNos) {
                const res = extractDerivedValue(fNo);
                if (res.hasVal) {
                    hasAnswer = true;
                    sourceType = res.sourceType;
                    isScoped = res.isScoped;
                    evidenceProvider = res.evidenceProvider;
                    displayState = res.displayState;
                    break;
                }
            }
        }

        // C. Custom Field
        if (!hasAnswer && q.customFieldDefinitionId !== null && customData) {
            const cVal = (customData as Record<string, any>)[q.customFieldDefinitionId];
            if (cVal !== undefined && cVal !== null) {
                const valObj = typeof cVal === "object" ? cVal : { value: cVal };
                if (valObj.value !== undefined && valObj.value !== null && valObj.value !== "") {
                    hasAnswer = true;
                    sourceType = valObj.source || "USER_INPUT";
                    isScoped = true;
                    evidenceProvider = null;
                } else if (valObj.explicitNone === true) {
                    hasAnswer = true;
                    sourceType = valObj.source || "USER_INPUT";
                    isScoped = true;
                    evidenceProvider = null;
                }
            }
        }

        // D. Fallback to q.answer stored directly on Question record
        if (!hasAnswer && q.answer && q.answer.trim().length > 0 && q.answer !== "null" && q.answer !== "{}") {
            hasAnswer = true;
            sourceType = "USER_INPUT";
            isScoped = true;
        }

        const category = classifyQuestionAnswerState(hasAnswer, sourceType, isScoped, evidenceProvider, displayState);

        if (category === "EXTERNAL") {
            m.external++;
        } else if (category === "USER_INPUT") {
            m.userInput++;
        } else if (category === "DEFAULT_RESPONSE") {
            m.defaultResponse++;
        } else {
            m.unanswered++;
        }
    }

    return m;
}

/**
 * Calculates QuestionStateMetrics for an engagement's structured questions.
 */
export async function calculateEngagementQuestionStateMetrics(engagementId: string): Promise<QuestionStateMetrics> {
    const questions = await prisma.question.findMany({
        where: {
            questionnaire: {
                OR: [
                    { fiEngagementId: engagementId },
                    { engagements: { some: { id: engagementId } } },
                ],
                isDeleted: false,
            },
        },
        select: {
            id: true,
            answer: true,
            masterFieldNo: true,
            masterQuestionGroupId: true,
            customFieldDefinitionId: true,
            questionnaireId: true,
        },
    });

    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        select: {
            clientLE: {
                select: { id: true, customData: true, legalEntityId: true },
            },
        },
    });

    if (!engagement) return emptyQuestionStateMetrics();

    const m = await calculateQuestionStateMetricsForQuestions(
        questions,
        engagement.clientLE?.legalEntityId,
        engagement.clientLE?.customData as any,
        engagement.clientLE?.id
    );

    return m;
}

/**
 * Calculates QuestionStateMetrics for a Common Questionnaire.
 */
export async function calculateCQQuestionStateMetrics(
    questionnaireId: string,
    clientLeId: string
): Promise<QuestionStateMetrics> {
    const clientLe = await prisma.clientLE.findUnique({
        where: { id: clientLeId },
        select: { id: true, customData: true, legalEntityId: true },
    });

    const questions = await prisma.question.findMany({
        where: { questionnaireId, questionnaire: { isDeleted: false } },
        select: {
            id: true,
            answer: true,
            masterFieldNo: true,
            masterQuestionGroupId: true,
            customFieldDefinitionId: true,
            questionnaireId: true,
        },
    });

    const m = await calculateQuestionStateMetricsForQuestions(
        questions,
        clientLe?.legalEntityId,
        clientLe?.customData as any,
        clientLe?.id
    );

    m.questionnairesCount = 1;
    return m;
}
