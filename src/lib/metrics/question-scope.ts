export type QuestionScopeMode = "relationship-own" | "relationship-effective";

export type QuestionScope = {
    leId?: string | null;
    relationshipId?: string | null;   // Stable ID (fiEngagementId)
    questionnaireId?: string | null;  // Stable ID (questionnaireId)
    rel?: string | null;              // Legacy supplier name fallback
    q?: string | null;                // Legacy questionnaire name fallback
    isCommon?: boolean | null;        // Explicit Common Questionnaires filter
    scopeMode?: QuestionScopeMode;    // "relationship-own" (strictly own questions) or "relationship-effective" (own + applicable CQ)
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
 * 1. Explicit Common Questionnaires scope (isCommon === true or rel === "Common"):
 *    - Matches questions where q.isCommon === true || q.engagementOrgName === "Common".
 * 
 * 2. Relationship scope:
 *    - scopeMode: "relationship-own":
 *      Matches questions directly owned by the relationship (q.fiEngagementId === relationshipId).
 *      Common Questionnaires are strictly excluded.
 *    - scopeMode: "relationship-effective" (default for backwards compatibility):
 *      Matches questions owned by the relationship PLUS applicable Common Questionnaires for the LE.
 * 
 * 3. Questionnaire scope:
 *    - If questionnaireId (stable ID) is specified: Matches q.questionnaireId === questionnaireId.
 *    - Else if q (legacy name) is specified and q !== "ALL": Matches q.questionnaireName === q.
 */
export function isQuestionInPopulationScope(
    target: QuestionScopeTarget,
    scope: QuestionScope
): boolean {
    const scopeMode: QuestionScopeMode = scope.scopeMode ?? "relationship-effective";

    // 1. Common Questionnaires explicit scope
    if (scope.isCommon === true || scope.rel === "Common") {
        const isCQ = target.isCommon === true || target.engagementOrgName === "Common";
        if (!isCQ) return false;
    }
    // 2. Relationship population scope
    else if (scope.relationshipId && scope.relationshipId !== "ALL") {
        const isEngagementOwn = target.fiEngagementId === scope.relationshipId;
        if (scopeMode === "relationship-own") {
            const isCQ = target.isCommon === true || target.engagementOrgName === "Common";
            if (!isEngagementOwn || isCQ) {
                return false;
            }
        } else {
            const isApplicableCQ = target.isCommon === true || target.engagementOrgName === "Common";
            if (!isEngagementOwn && !isApplicableCQ) {
                return false;
            }
        }
    } else if (scope.rel && scope.rel !== "ALL") {
        const isSupplierOwn = target.engagementOrgName === scope.rel;
        if (scopeMode === "relationship-own") {
            const isCQ = target.isCommon === true || target.engagementOrgName === "Common";
            if (!isSupplierOwn || isCQ) {
                return false;
            }
        } else {
            const isApplicableCQ = target.isCommon === true || target.engagementOrgName === "Common";
            if (!isSupplierOwn && !isApplicableCQ) {
                return false;
            }
        }
    }

    // 3. Questionnaire population scope
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
 * 2. Under a specific relationship (relationshipId or rel):
 *    - With scopeMode: "relationship-own": includes only questionnaires belonging to that engagement.
 *    - With scopeMode: "relationship-effective": includes questionnaires belonging to that engagement PLUS applicable Common Questionnaires.
 * 3. Preserves deterministic sorting by name.
 */
export function deriveEligibleQuestionnaireOptions(
    questions: QuestionScopeTarget[],
    relationshipScope: Pick<QuestionScope, "relationshipId" | "rel">,
    scopeMode?: QuestionScopeMode
): QuestionnaireOption[] {
    const map = new Map<string, QuestionnaireOption>();

    const relevantQuestions = questions.filter(q => {
        return isQuestionInPopulationScope(q, {
            relationshipId: relationshipScope.relationshipId,
            rel: relationshipScope.rel,
            questionnaireId: "ALL",
            q: "ALL",
            scopeMode,
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
