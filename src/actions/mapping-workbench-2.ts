"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/actions/admin";
import { getPathHint } from "@/lib/mapping-workbench/semantic-hints";
import { SOURCE_OPTIONS, SourceOption } from "@/lib/source-display";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Wb2PathMapping {
    mappingId: string;
    targetFieldNo: number;
    targetFieldName: string | null;
    isActive: boolean;
    transformType: string;
    priority: number;
    confidenceDefault: number;
    notes: string | null;
}

export interface Wb2SourcePath {
    path: string;
    meaning: string | null;
    exampleValue: string | null;
    mappings: Wb2PathMapping[];  // all mappings from this path (0, 1 or many)
    isMapped: boolean;          // any active mapping exists
    mappedToFieldNos: number[]; // for graph lookups
}

export interface Wb2SourceData {
    sourceKey: string;          // e.g. "GLEIF" or "CH_RA000585"
    sourceType: string;         // "GLEIF" | "REGISTRATION_AUTHORITY"
    sourceReference: string | null;
    label: string;              // "Companies House (RA000585)"
    paths: Wb2SourcePath[];
    mappedCount: number;
    availableCount: number;
}

export interface Wb2MasterField {
    fieldNo: number;
    fieldName: string;
    appDataType: string;
    isMultiValue: boolean;
    categoryName: string | null;
    description: string | null;
    /** Which source keys have active mappings to this field */
    mappedBySources: string[];
    /** How many questionnaire questions reference this field */
    questionCount: number;
    hasError: boolean;
}

export interface Wb2Question {
    id: string;
    text: string;
    masterFieldNo: number | null;
    masterFieldName: string | null;
    masterQuestionGroupId: string | null;
    masterQuestionGroupLabel: string | null;
    customFieldDefinitionId: string | null;
    status: string;
    isMapped: boolean;
    /** Which source keys ultimately supply this question (via master field) */
    sourcedFrom: string[];
}

export interface Wb2Questionnaire {
    id: string;
    name: string;
    questions: Wb2Question[];
    mappedCount: number;
    unmappedCount: number;
}

export interface Wb2PageData {
    sources: Wb2SourceData[];
    masterFields: Wb2MasterField[];
    masterFieldsMappedCount: number;
    masterFieldsUnmappedCount: number;
    questionnaires: Wb2Questionnaire[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function flattenPaths(obj: any, prefix = "", depth = 0): string[] {
    if (depth > 6 || obj == null || typeof obj !== "object") return [];
    const paths: string[] = [];
    if (Array.isArray(obj)) {
        if (obj.length > 0) {
            paths.push(...flattenPaths(obj[0], `${prefix}[0]`, depth + 1).map(p => p));
        }
    } else {
        for (const [k, v] of Object.entries(obj)) {
            const fullPath = prefix ? `${prefix}.${k}` : k;
            paths.push(fullPath);
            if (typeof v === "object" && v !== null) {
                paths.push(...flattenPaths(v, fullPath, depth + 1));
            }
        }
    }
    return paths;
}

function resolveValue(obj: any, path: string): string | null {
    try {
        const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
        let cur: any = obj;
        for (const p of parts) {
            if (cur == null) return null;
            cur = cur[p];
        }
        if (cur == null) return null;
        if (typeof cur === "object") return JSON.stringify(cur).slice(0, 60);
        return String(cur).slice(0, 60);
    } catch { return null; }
}

// ── Main action ────────────────────────────────────────────────────────────

export async function getMappingWorkbench2Data(): Promise<Wb2PageData> {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const [allMappings, fieldDefs, samplePayloads, questionnaires, groups] = await Promise.all([
        prisma.sourceFieldMapping.findMany({
            orderBy: [{ sourceType: "asc" }, { priority: "asc" }],
        }),
        prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            include: { masterDataCategory: true },
            orderBy: [{ order: "asc" }, { fieldNo: "asc" }],
        }),
        prisma.sourceSamplePayload.findMany({
            where: { isDefault: true },
            select: { sourceType: true, payload: true },
        }),
        prisma.questionnaire.findMany({
            where: { isDeleted: false, isTemplate: true },
            include: {
                questions: {
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        text: true,
                        masterFieldNo: true,
                        masterQuestionGroupId: true,
                        customFieldDefinitionId: true,
                        status: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
        prisma.masterFieldGroup.findMany({
            where: { isActive: true },
            select: { key: true, label: true },
        }),
    ]);

    // ── Index maps ──────────────────────────────────────────────────────
    const fieldByNo = new Map(fieldDefs.map((f: any) => [f.fieldNo, f]));
    const groupByKey = new Map(groups.map((g: any) => [g.key, g]));

    // mappingsBySource: sourceKey → mapping[]
    const mappingsBySource = new Map<string, typeof allMappings>();
    for (const m of allMappings) {
        const key = m.sourceReference
            ? `${m.sourceType}:${m.sourceReference}`
            : m.sourceType;
        const arr = mappingsBySource.get(key) ?? [];
        arr.push(m);
        mappingsBySource.set(key, arr);
    }

    // sampleBySourceType: "GLEIF" | "REGISTRATION_AUTHORITY" → payload JSON
    const sampleBySourceType = new Map<string, any>();
    for (const sp of samplePayloads) {
        // Store by sourceType — all RA sources share the same super-schema sample
        sampleBySourceType.set(sp.sourceType as string, (sp as any).payload);
    }

    // fieldNo → which sourceKeys map to it (active)
    const fieldSourceMap = new Map<number, Set<string>>();
    for (const m of allMappings) {
        if (!m.isActive) continue;
        const key = m.sourceReference ? `${m.sourceType}:${m.sourceReference}` : m.sourceType;
        const s = fieldSourceMap.get(m.targetFieldNo) ?? new Set();
        s.add(key);
        fieldSourceMap.set(m.targetFieldNo, s);
    }

    // ── Build source data ───────────────────────────────────────────────
    const sources: Wb2SourceData[] = SOURCE_OPTIONS.map((opt: SourceOption) => {
        const sourceKey = opt.value;
        // Map SOURCE_OPTIONS key → internal lookup key
        const internalKey = opt.sourceReference
            ? `${opt.sourceType}:${opt.sourceReference}`
            : opt.sourceType;

        const sourceMappings = mappingsBySource.get(internalKey) ?? [];
        const samplePayload = sampleBySourceType.get(opt.sourceType);

        // All paths: from sample payload + from existing mappings
        const samplePaths = samplePayload ? flattenPaths(samplePayload) : [];
        const mappingPaths = sourceMappings.map((m: any) => m.sourcePath);
        const allPaths = [...new Set([...mappingPaths, ...samplePaths])].sort();

        // Build path rows — collect ALL mappings per path
        const paths: Wb2SourcePath[] = allPaths.map(path => {
            const pathMappings = sourceMappings.filter((m: any) => m.sourcePath === path);
            // meaning: notes from first mapping, or semantic hint, or null
            const firstMapping = pathMappings[0] as any;
            const meaning = firstMapping?.notes?.trim()
                ? firstMapping.notes.trim()
                : getPathHint(opt.sourceType, path);

            const mappings: Wb2PathMapping[] = pathMappings.map((m: any) => {
                const targetField = fieldByNo.get(m.targetFieldNo) as any;
                return {
                    mappingId: m.id,
                    targetFieldNo: m.targetFieldNo,
                    targetFieldName: targetField?.fieldName ?? null,
                    isActive: m.isActive,
                    transformType: m.transformType,
                    priority: m.priority,
                    confidenceDefault: m.confidenceDefault,
                    notes: m.notes ?? null,
                };
            });

            const activeFieldNos = mappings.filter(m => m.isActive).map(m => m.targetFieldNo);

            return {
                path,
                meaning: meaning || null,
                exampleValue: samplePayload ? resolveValue(samplePayload, path) : null,
                mappings,
                isMapped: activeFieldNos.length > 0,
                mappedToFieldNos: activeFieldNos,
            };
        });

        const mappedCount = paths.filter(p => p.isMapped).length;

        return {
            sourceKey,
            sourceType: opt.sourceType,
            sourceReference: opt.sourceReference,
            label: opt.label,
            paths,
            mappedCount,
            availableCount: allPaths.length,
        };
    });


    // ── Build master field data ─────────────────────────────────────────

    // fieldNo → question count (across all questionnaires)
    const fieldQuestionCount = new Map<number, number>();
    for (const qnaire of questionnaires) {
        for (const q of qnaire.questions) {
            if (q.masterFieldNo) {
                fieldQuestionCount.set(q.masterFieldNo, (fieldQuestionCount.get(q.masterFieldNo) ?? 0) + 1);
            }
        }
    }

    const masterFields: Wb2MasterField[] = fieldDefs.map((f: any) => {
        const sources = fieldSourceMap.get(f.fieldNo);
        const mappedBySources = sources ? [...sources] : [];
        const hasError = f.isMultiValue && (fieldQuestionCount.get(f.fieldNo) ?? 0) > 0;

        return {
            fieldNo: f.fieldNo,
            fieldName: f.fieldName,
            appDataType: f.appDataType,
            isMultiValue: f.isMultiValue,
            categoryName: f.masterDataCategory?.displayName ?? null,
            description: f.description ?? null,
            mappedBySources,
            questionCount: fieldQuestionCount.get(f.fieldNo) ?? 0,
            hasError,
        };
    });

    const masterFieldsMappedCount = masterFields.filter(f => f.mappedBySources.length > 0).length;
    const masterFieldsUnmappedCount = masterFields.length - masterFieldsMappedCount;

    // ── Build questionnaire data ────────────────────────────────────────

    // For each question, resolve upstream sources via its masterFieldNo
    const wb2Questionnaires: Wb2Questionnaire[] = questionnaires.map((qnaire: any) => {
        const questions: Wb2Question[] = qnaire.questions.map((q: any) => {
            const masterField = q.masterFieldNo ? fieldByNo.get(q.masterFieldNo) : null;
            const masterGroup = q.masterQuestionGroupId ? (groupByKey.get(q.masterQuestionGroupId) as any) : null;
            const isMapped = !!(q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId);

            // Upstream sources: from field's mappedBySources
            const sourcedFrom = q.masterFieldNo
                ? [...(fieldSourceMap.get(q.masterFieldNo) ?? [])]
                : [];

            return {
                id: q.id,
                text: q.text,
                masterFieldNo: q.masterFieldNo ?? null,
                masterFieldName: (masterField as any)?.fieldName ?? null,
                masterQuestionGroupId: q.masterQuestionGroupId ?? null,
                masterQuestionGroupLabel: masterGroup?.label ?? null,
                customFieldDefinitionId: q.customFieldDefinitionId ?? null,
                status: q.status ?? "DRAFT",
                isMapped,
                sourcedFrom,
            };
        });

        const mappedCount = questions.filter(q => q.isMapped).length;
        const unmappedCount = questions.length - mappedCount;

        return {
            id: qnaire.id,
            name: qnaire.name,
            questions,
            mappedCount,
            unmappedCount,
        };
    });

    return {
        sources,
        masterFields,
        masterFieldsMappedCount,
        masterFieldsUnmappedCount,
        questionnaires: wb2Questionnaires,
    };
}
