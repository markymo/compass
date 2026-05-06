import { MomentumReadiness, FieldReadinessRow, CategoryReadiness } from "@/actions/momentum";

/**
 * Pure helper to calculate summary stats for a given set of fields/categories.
 * Supports both global and focused views.
 */
export function calculateMomentumStats(data: MomentumReadiness, focusedCategoryId: string | null) {
    const focusedCategory = focusedCategoryId ? data.categories.find(c => c.id === focusedCategoryId) : null;

    const total = focusedCategory ? focusedCategory.totalFields : data.totalFields;
    const described = focusedCategory ? focusedCategory.descriptionCount : data.describedFields;
    const mapped = focusedCategory ? focusedCategory.mappingCount : data.mappedFields;
    const complete = focusedCategory ? focusedCategory.fullyCompleteCount : data.fullyCompleteFields;

    const getPercentage = (value: number, totalVal: number) => 
        totalVal > 0 ? (value / totalVal) * 100 : 0;

    return {
        total,
        described,
        mapped,
        complete,
        percentages: {
            described: getPercentage(described, total),
            mapped: getPercentage(mapped, total),
            complete: getPercentage(complete, total)
        },
        focusedCategory
    };
}

/**
 * Deterministic logic to pick the Next Best Action.
 * Replicates the server-side logic for consistency.
 */
export function selectNextBestAction(data: MomentumReadiness, focusedCategoryId: string | null) {
    // If not focused, use the pre-calculated NBA from the server
    if (!focusedCategoryId) return data.nextBestAction;

    // Filter to focused fields
    const catFields = data.fields.filter(f => 
        (f.rawField.categoryId === focusedCategoryId) || 
        (focusedCategoryId === 'uncategorized' && !f.rawField.categoryId)
    );

    if (catFields.length === 0) return null;

    // Find the first missing dimension
    // Priority: Description first, then UK Mapping
    const missingDesc = catFields.find(f => !f.descriptionStatus);
    const missingMap = catFields.find(f => !f.mappingStatus);
    const target = missingDesc || missingMap;

    if (!target) return null; // Category complete

    const focusedCategory = data.categories.find(c => c.id === focusedCategoryId);

    return {
        type: (missingDesc ? "DESCRIPTION" : "MAPPING") as "DESCRIPTION" | "MAPPING",
        fieldNo: target.fieldNo,
        fieldName: target.fieldName,
        categoryName: target.categoryName,
        categoryKey: focusedCategory?.key || "UNCAT",
        actionsToComplete: target.actionsToComplete,
        fullyCompleteCount: focusedCategory?.fullyCompleteCount || 0,
        totalFields: focusedCategory?.totalFields || 0,
        rawField: target.rawField
    };
}

/**
 * Suggest the most logical next category to focus on.
 * Used when a focus is complete or being cleared.
 */
export function suggestNextCategory(data: MomentumReadiness, currentFocusedId: string | null) {
    // Exclude current and already complete categories
    const candidates = data.categories.filter(c => 
        c.id !== currentFocusedId && 
        c.actionsToComplete > 0
    );

    if (candidates.length === 0) return null;

    // 1. Check for "Nearly Complete" categories (1-5 actions)
    const nearlyComplete = candidates
        .filter(c => c.actionsToComplete <= 5)
        .sort((a, b) => a.actionsToComplete - b.actionsToComplete);

    if (nearlyComplete.length > 0) return nearlyComplete[0];

    // 2. Fallback to highest completion percentage
    return candidates.sort((a, b) => {
        const aPct = a.totalFields > 0 ? a.fullyCompleteCount / a.totalFields : 0;
        const bPct = b.totalFields > 0 ? b.fullyCompleteCount / b.totalFields : 0;
        return bPct - aPct;
    })[0];
}
