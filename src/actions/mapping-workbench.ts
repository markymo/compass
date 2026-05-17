"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/actions/admin";
import { generateFieldWarnings, WarningInputField } from "@/lib/mapping-workbench/warnings";
import { getPathHint } from "@/lib/mapping-workbench/semantic-hints";

export interface WorkbenchField {
    fieldNo: number;
    fieldName: string;
    appDataType: string;
    isMultiValue: boolean;
    isActive: boolean;
    description: string | null;
    notes: string | null;
    fmsbRef: string | null;
    domain: string[];
    categoryId: string | null;
    categoryName: string | null;
    order: number;
    options: string[];

    sourceMappings: WorkbenchSourceMapping[];
    questionUsage: WorkbenchQuestionUsage[];
    groupMembership: WorkbenchGroupMembership[];
    warnings: ReturnType<typeof generateFieldWarnings>;
    warningCount: number;
    errorCount: number;
}

export interface WorkbenchSourceMapping {
    id: string;
    sourceType: string;
    sourceReference: string | null;
    sourceDisplayName: string;
    sourcePath: string;
    /** Human-readable meaning: notes first, then hint dict, then heuristic */
    pathMeaning: string | null;
    transformType: string;
    confidenceDefault: number;
    priority: number;
    isActive: boolean;
    notes: string | null;
    /** Resolved from the sample payload if available */
    exampleValue: string | null;
}

export interface WorkbenchQuestionUsage {
    questionId: string;
    questionText: string;
    questionnaireName: string;
    questionnaireId: string;
    status: string;
}

export interface WorkbenchGroupMembership {
    groupKey: string;
    groupLabel: string;
    order: number;
}

export interface WorkbenchPageData {
    fields: WorkbenchField[];
    totalFields: number;
    totalMappings: number;
    totalWithWarnings: number;
    totalErrors: number;
}

/** Resolve a RA code to a friendly display name */
function raDisplayName(sourceType: string, sourceReference: string | null): string {
    if (sourceType === "GLEIF") return "GLEIF";
    if (!sourceReference) return "Registration Authority (global)";
    const known: Record<string, string> = {
        RA000585: "Companies House (UK · RA000585)",
        RA000586: "Companies House Scotland (RA000586)",
        RA000587: "Companies House NI (RA000587)",
        RA000242: "Handelsregister (DE · RA000242)",
        RA000192: "RNCS / Infogreffe (FR · RA000192)",
    };
    return known[sourceReference] ?? `Registry ${sourceReference}`;
}

export async function getMappingWorkbenchData(): Promise<WorkbenchPageData> {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // ── Parallel data fetch ──────────────────────────────────────────────
    const [fields, allQuestions, samplePayloads, groups] = await Promise.all([
        prisma.masterFieldDefinition.findMany({
            include: {
                masterDataCategory: true,
                sourceMappings: {
                    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
                },
                graphBindings: { where: { isActive: true } },
                groupItems: {
                    include: { group: { select: { key: true, label: true } } },
                    orderBy: { order: "asc" },
                },
            },
            orderBy: [{ order: "asc" }, { fieldNo: "asc" }],
        }),

        // All questions with masterFieldNo — we need them to determine questionnaire usage
        prisma.question.findMany({
            where: {
                masterFieldNo: { not: null },
                questionnaire: { isDeleted: false },
            },
            select: {
                id: true,
                text: true,
                status: true,
                masterFieldNo: true,
                questionnaire: {
                    select: { id: true, name: true },
                },
            },
        }),

        // Sample payloads for resolving example values
        prisma.sourceSamplePayload.findMany({
            where: { isDefault: true },
            select: { sourceType: true, payload: true },
        }),

        // Groups for membership display
        prisma.masterFieldGroup.findMany({
            where: { isActive: true },
            select: { key: true, label: true },
        }),
    ]);

    // ── Build lookup maps ────────────────────────────────────────────────
    // Map fieldNo → question[]
    const questionsByField = new Map<number, typeof allQuestions>();
    for (const q of allQuestions) {
        if (q.masterFieldNo == null) continue;
        const existing = questionsByField.get(q.masterFieldNo) ?? [];
        existing.push(q);
        questionsByField.set(q.masterFieldNo, existing);
    }

    // Map sourceType → sample payload (for example value extraction)
    const sampleBySource = new Map<string, any>();
    for (const sp of samplePayloads) {
        sampleBySource.set(sp.sourceType, sp.payload);
    }

    // ── Resolve example value from a sample payload ──────────────────────
    function resolveExampleFromSample(sourceType: string, sourcePath: string): string | null {
        const payload = sampleBySource.get(sourceType);
        if (!payload) return null;
        try {
            // Simple dot + bracket resolver for sample payloads
            const parts = sourcePath.replace(/\[(\d+)\]/g, ".$1").split(".");
            let cur: any = payload;
            for (const p of parts) {
                if (cur == null) return null;
                cur = cur[p];
            }
            if (cur == null) return null;
            if (typeof cur === "object") return JSON.stringify(cur).slice(0, 80);
            return String(cur).slice(0, 80);
        } catch {
            return null;
        }
    }

    // ── Assemble WorkbenchField[] ────────────────────────────────────────
    const workbenchFields: WorkbenchField[] = fields.map((f: any) => {
        const sourceMappings: WorkbenchSourceMapping[] = f.sourceMappings.map((m: any) => {
            const hint = getPathHint(m.sourceType, m.sourcePath);
            const pathMeaning = m.notes && m.notes.trim()
                ? m.notes.trim()   // admin-curated note wins
                : hint;            // dict / heuristic fallback

            return {
                id: m.id,
                sourceType: m.sourceType,
                sourceReference: m.sourceReference ?? null,
                sourceDisplayName: raDisplayName(m.sourceType, m.sourceReference),
                sourcePath: m.sourcePath,
                pathMeaning,
                transformType: m.transformType,
                confidenceDefault: m.confidenceDefault,
                priority: m.priority,
                isActive: m.isActive,
                notes: m.notes ?? null,
                exampleValue: resolveExampleFromSample(m.sourceType, m.sourcePath),
            };
        });

        const fieldQuestions = questionsByField.get(f.fieldNo) ?? [];
        const questionUsage: WorkbenchQuestionUsage[] = fieldQuestions.map((q: any) => ({
            questionId: q.id,
            questionText: q.text,
            questionnaireName: q.questionnaire.name,
            questionnaireId: q.questionnaire.id,
            status: q.status,
        }));

        const groupMembership: WorkbenchGroupMembership[] = (f.groupItems as any[]).map((gi) => ({
            groupKey: gi.group.key,
            groupLabel: gi.group.label,
            order: gi.order,
        }));

        const warningInput: WarningInputField = {
            fieldNo: f.fieldNo,
            fieldName: f.fieldName,
            isMultiValue: f.isMultiValue,
            isActive: f.isActive,
            description: f.description ?? null,
            notes: f.notes ?? null,
            sourceMappings: f.sourceMappings.map((m: any) => ({
                id: m.id,
                sourceType: m.sourceType,
                sourceReference: m.sourceReference ?? null,
                sourcePath: m.sourcePath,
                isActive: m.isActive,
            })),
            questionUsageCount: fieldQuestions.length,
        };

        const warnings = generateFieldWarnings(warningInput);

        return {
            fieldNo: f.fieldNo,
            fieldName: f.fieldName,
            appDataType: f.appDataType,
            isMultiValue: f.isMultiValue,
            isActive: f.isActive,
            description: f.description ?? null,
            notes: f.notes ?? null,
            fmsbRef: f.fmsbRef ?? null,
            domain: f.domain,
            order: f.order,
            options: f.options,
            categoryId: f.categoryId ?? null,
            categoryName: (f as any).masterDataCategory?.displayName ?? null,
            sourceMappings,
            questionUsage,
            groupMembership,
            warnings,
            warningCount: warnings.length,
            errorCount: warnings.filter((w) => w.severity === "error").length,
        };
    });

    const totalMappings = workbenchFields.reduce((sum, f) => sum + f.sourceMappings.length, 0);
    const totalWithWarnings = workbenchFields.filter((f) => f.warningCount > 0).length;
    const totalErrors = workbenchFields.filter((f) => f.errorCount > 0).length;

    return {
        fields: workbenchFields,
        totalFields: workbenchFields.length,
        totalMappings,
        totalWithWarnings,
        totalErrors,
    };
}
