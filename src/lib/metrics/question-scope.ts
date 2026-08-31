export type QuestionScope = {
    leId?: string | null;
    relationshipId?: string | null;   // Stable ID (fiEngagementId)
    questionnaireId?: string | null;  // Stable ID (questionnaireId)
    rel?: string | null;              // Legacy supplier name fallback
    q?: string | null;                // Legacy questionnaire name fallback
};

export type QuestionScopeTarget = {
    fiEngagementId?: string | null;
    questionnaireId?: string | null;
    engagementOrgName?: string | null;
    questionnaireName?: string | null;
    isCommon?: boolean | null;
};

/**
 * Evaluates whether a question belongs to the given population scope (LE / Relationship / Questionnaire).
 * Note: Answer state classification is deliberately handled as a separate filter dimension.
 * 
 * Scope Matching Rules:
 * 1. Relationship scope:
 *    - If relationshipId (stable ID) is specified: Matches questions owned by that engagement (q.fiEngagementId === relationshipId)
 *      PLUS applicable Common Questionnaire questions for the LE (q.isCommon === true || q.engagementOrgName === "Common").
 *    - Else if rel (legacy name) is specified and rel !== "ALL":
 *      - If rel === "Common": Matches Common Questionnaire questions (q.isCommon === true || q.engagementOrgName === "Common").
 *      - Otherwise: Matches questions for that supplier name (q.engagementOrgName === rel)
 *        PLUS applicable Common Questionnaire questions for the LE.
 * 
 * 2. Questionnaire scope:
 *    - If questionnaireId (stable ID) is specified: Matches q.questionnaireId === questionnaireId.
 *    - Else if q (legacy name) is specified and q !== "ALL": Matches q.questionnaireName === q.
 */
export function isQuestionInPopulationScope(
    target: QuestionScopeTarget,
    scope: QuestionScope
): boolean {
    // 1. Relationship population scope
    if (scope.relationshipId && scope.relationshipId !== "ALL") {
        const isEngagementOwn = target.fiEngagementId === scope.relationshipId;
        const isApplicableCQ = target.isCommon === true || target.engagementOrgName === "Common";
        if (!isEngagementOwn && !isApplicableCQ) {
            return false;
        }
    } else if (scope.rel && scope.rel !== "ALL") {
        if (scope.rel === "Common") {
            const isCQ = target.isCommon === true || target.engagementOrgName === "Common";
            if (!isCQ) return false;
        } else {
            const isSupplierOwn = target.engagementOrgName === scope.rel;
            const isApplicableCQ = target.isCommon === true || target.engagementOrgName === "Common";
            if (!isSupplierOwn && !isApplicableCQ) return false;
        }
    }

    // 2. Questionnaire population scope
    if (scope.questionnaireId && scope.questionnaireId !== "ALL") {
        if (target.questionnaireId !== scope.questionnaireId) {
            return false;
        }
    } else if (scope.q && scope.q !== "ALL") {
        if (target.questionnaireName !== scope.q) {
            return false;
        }
    }

    return true;
}

export type QuestionnaireOption = {
    id?: string;
    name: string;
};

/**
 * Derives unique, eligible questionnaire options for the Client Cross-Questionnaire Mapper
 * scoped to the active relationship (relationshipId / rel).
 * 
 * Invariants:
 * 1. Under "ALL" relationships: includes all questionnaires across all engagements PLUS Common Questionnaires.
 * 2. Under a specific relationship (relationshipId or rel): includes only questionnaires belonging to that engagement
 *    PLUS applicable Common Questionnaires. Excludes questionnaires belonging solely to other engagements.
 * 3. Preserves deterministic sorting by name.
 */
export function deriveEligibleQuestionnaireOptions(
    questions: QuestionScopeTarget[],
    relationshipScope: Pick<QuestionScope, "relationshipId" | "rel">
): QuestionnaireOption[] {
    const map = new Map<string, QuestionnaireOption>();

    const relevantQuestions = questions.filter(q => {
        return isQuestionInPopulationScope(q, {
            relationshipId: relationshipScope.relationshipId,
            rel: relationshipScope.rel,
            questionnaireId: "ALL",
            q: "ALL",
        });
    });

    for (const q of relevantQuestions) {
        if (q.questionnaireId && q.questionnaireName) {
            map.set(q.questionnaireId, { id: q.questionnaireId, name: q.questionnaireName });
        } else if (q.questionnaireName) {
            map.set(q.questionnaireName, { id: undefined, name: q.questionnaireName });
        }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export type SupplierQuestionnaireTarget = {
    clientLEName?: string | null;
    questionnaireName?: string | null;
};

/**
 * Derives unique, eligible questionnaire names for the Supplier Questions Workbench
 * scoped to the active client relationship (relFilter).
 */
export function deriveEligibleSupplierQuestionnaires(
    questions: SupplierQuestionnaireTarget[],
    activeClientLEName?: string | null
): string[] {
    const relevantQuestions = (!activeClientLEName || activeClientLEName === "ALL")
        ? questions
        : questions.filter(q => q.clientLEName === activeClientLEName);

    const unique = Array.from(new Set(relevantQuestions.map(q => q.questionnaireName).filter(Boolean) as string[]));
    return unique.sort((a, b) => a.localeCompare(b));
}
