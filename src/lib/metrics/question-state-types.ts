export type QuestionStateMetrics = {
    questionnairesCount?: number;
    total: number;
    external: number;
    userInput: number;
    defaultResponse: number;
    unanswered: number;
};

export function emptyQuestionStateMetrics(): QuestionStateMetrics {
    return {
        questionnairesCount: 0,
        total: 0,
        external: 0,
        userInput: 0,
        defaultResponse: 0,
        unanswered: 0,
    };
}

export function rollupQuestionStateMetrics(
    dest: QuestionStateMetrics,
    src: QuestionStateMetrics
): QuestionStateMetrics {
    dest.questionnairesCount = (dest.questionnairesCount || 0) + (src.questionnairesCount || 0);
    dest.total += src.total;
    dest.external += src.external;
    dest.userInput += src.userInput;
    dest.defaultResponse += src.defaultResponse;
    dest.unanswered += src.unanswered;
    return dest;
}

export type QuestionAnswerCategory = "EXTERNAL" | "USER_INPUT" | "DEFAULT_RESPONSE" | "UNANSWERED";

/**
 * Classifies the single winning effective answer of a question based on canonical precedence:
 * 1. If displayState is DEFAULT_RESPONSE or winning sourceType is DEFAULT_RESPONSE -> DEFAULT_RESPONSE.
 * 2. If isScoped or winning sourceType is USER_INPUT/MANUAL -> USER_INPUT.
 * 3. If winning sourceType/evidenceProvider is an external source -> EXTERNAL.
 * 4. If no effective answer value exists -> UNANSWERED.
 * 
 * Enforces mutual exclusivity: Every question belongs to exactly one category.
 */
export function classifyQuestionAnswerState(
    hasAnswer: boolean,
    sourceType?: string | null,
    isScoped?: boolean | null,
    evidenceProvider?: string | null,
    displayState?: string | null
): QuestionAnswerCategory {
    const normSource = (sourceType || evidenceProvider || "").toUpperCase().trim();
    const normState = (displayState || "").toUpperCase().trim();

    if (
        normState === "DEFAULT_RESPONSE" ||
        normState === "DEFAULT" ||
        normSource === "DEFAULT_RESPONSE" ||
        normSource === "DEFAULT"
    ) {
        return "DEFAULT_RESPONSE";
    }

    if (normState === "CHECKED_NO_DATA") {
        return isScoped ? "USER_INPUT" : "EXTERNAL";
    }

    if (!hasAnswer) {
        return "UNANSWERED";
    }

    if (isScoped) {
        return "USER_INPUT";
    }

    if (!normSource || normSource === "USER_INPUT" || normSource === "MANUAL" || normSource === "MASTER_RECORD") {
        return "USER_INPUT";
    }

    const knownExternalSources = [
        "COMPANIES_HOUSE",
        "GLEIF",
        "REGISTRATION_AUTHORITY",
        "NATIONAL_REGISTRY",
        "STATUTORY_FILING",
        "TAX_AUTHORITY",
        "FINANCIAL_REGULATOR",
        "BANKING_PARTNER",
        "AI_EXTRACTION",
        "SYSTEM_DERIVED",
        "LEI",
        "REGISTRY",
    ];

    if (knownExternalSources.includes(normSource) || (evidenceProvider && evidenceProvider.toUpperCase() !== "USER_INPUT")) {
        return "EXTERNAL";
    }

    return "USER_INPUT";
}
