/**
 * warnings.ts
 *
 * Pure warning-generation logic for the Mapping Workbench.
 * No DB writes. No side effects. Called at render time.
 */

export type WarningSeverity = "error" | "warning" | "info";

export interface FieldWarning {
    code: string;
    severity: WarningSeverity;
    title: string;
    detail: string;
}

export interface WarningInputField {
    fieldNo: number;
    fieldName: string;
    isMultiValue: boolean;
    isActive: boolean;
    description: string | null;
    notes: string | null;
    sourceMappings: Array<{
        id: string;
        sourceType: string;
        sourceReference: string | null;
        sourcePath: string;
        isActive: boolean;
    }>;
    /** Questions across all questionnaires mapped to this field */
    questionUsageCount: number;
}

export function generateFieldWarnings(field: WarningInputField): FieldWarning[] {
    const warnings: FieldWarning[] = [];
    const activeMappings = field.sourceMappings.filter(m => m.isActive);
    const inactiveMappings = field.sourceMappings.filter(m => !m.isActive);

    // ── Error: repeating field mapped to questionnaire with no row-binding support ──
    if (field.isMultiValue && field.questionUsageCount > 0) {
        warnings.push({
            code: "REPEATING_NO_ROW_BINDING",
            severity: "error",
            title: "Repeating field in questionnaire",
            detail: `F${field.fieldNo} is a repeating field (isMultiValue=true) but is mapped to ${field.questionUsageCount} questionnaire question(s). Questionnaire questions cannot yet bind to individual rows — prefill will show an array summary only. The "Field X is repeating and requires a rowId" error will occur if CH refresh touches this field.`,
        });
    }

    // ── Warning: no active source mapping at all ──
    if (activeMappings.length === 0 && inactiveMappings.length === 0) {
        warnings.push({
            code: "NO_SOURCE_MAPPING",
            severity: "warning",
            title: "No source mapping",
            detail: `F${field.fieldNo} has no source mappings. It cannot be automatically populated from GLEIF or registry data.`,
        });
    }

    // ── Warning: only inactive mappings ──
    if (activeMappings.length === 0 && inactiveMappings.length > 0) {
        warnings.push({
            code: "INACTIVE_MAPPINGS_ONLY",
            severity: "warning",
            title: "All source mappings are inactive",
            detail: `F${field.fieldNo} has ${inactiveMappings.length} mapping(s) but all are disabled. Automatic population is paused.`,
        });
    }

    // ── Info: multiple source systems (potential conflict) ──
    if (activeMappings.length >= 2) {
        const sourceSystems = new Set(
            activeMappings.map(m => m.sourceReference ? `${m.sourceType}:${m.sourceReference}` : m.sourceType)
        );
        if (sourceSystems.size >= 2) {
            warnings.push({
                code: "MULTIPLE_SOURCE_SYSTEMS",
                severity: "info",
                title: "Multiple source systems",
                detail: `F${field.fieldNo} has active mappings from ${sourceSystems.size} different source systems (${[...sourceSystems].join(", ")}). The overwrite priority rules determine which value wins.`,
            });
        }
    }

    // ── Info: no field description ──
    if (!field.description) {
        warnings.push({
            code: "NO_DESCRIPTION",
            severity: "info",
            title: "No public description",
            detail: `F${field.fieldNo} has no public-facing description. Questionnaire prefill tooltips and supplier-facing UI will show a blank description.`,
        });
    }

    return warnings;
}

export function warningColour(severity: WarningSeverity) {
    switch (severity) {
        case "error":   return { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",    icon: "text-red-500"   };
        case "warning": return { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-800",  icon: "text-amber-500" };
        case "info":    return { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-800",   icon: "text-blue-500"  };
    }
}
