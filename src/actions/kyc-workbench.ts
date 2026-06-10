"use server";

import prisma from "@/lib/prisma";
import { getConsoleQuestions, ConsoleQuestion, resolveMasterData, resolveMasterDataBatch, BatchResolverInput } from "./kyc-query";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { listAllMasterFields, listAllMasterGroups, listAllMasterGroupsWithItems, getMasterFieldGroup } from "@/services/masterData/definitionService";
import { getComplexFieldConfig } from "@/lib/master-data/complex-field-config";
import type { GroupFieldData } from "@/components/client/engagement/group-answer-renderer";
import { revalidatePath } from "next/cache";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { ensureQuestionNotReferenceSnapshot } from "./questionnaire";

export interface Workbench4Data {
    questions: ConsoleQuestion[];
    masterFields: Array<{ fieldNo: number; label: string; category?: string | null; dataType?: string | null; currentValue?: any }>;
    masterGroups: Array<{ key: string; label: string; category?: string | null; dataType?: string | null; currentValue?: any }>;
    customFields: Array<{ id: string; label: string; dataType?: string | null; currentValue?: any }>;
    relationships: string[];
    questionnaires: string[];
    ownerOrgId?: string;
}

/**
 * Fetches all necessary data for Workbench4:
 * - All questions across all engagements/questionnaires
 * - All available master fields (standard + custom)
 * - Unique relationships and questionnaires for filtering
 */
export async function getWorkbench4Data(leId: string): Promise<Workbench4Data> {
    const questions = await getConsoleQuestions(leId, true);

    // 1. Get standard Master Fields & Groups (with sub-field items for batch resolver)
    const [allFields, allGroupsWithItems] = await Promise.all([
        listAllMasterFields(),
        listAllMasterGroupsWithItems(),
    ]);
    const allGroups = allGroupsWithItems; // still compatible for label/category display

    const ownerScopeId = await KycStateService.resolveScopeId(leId);

    // Fast path to get current values — also pre-loads claims for batch resolver
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: leId },
        select: { legalEntityId: true, customData: true }
    });
    const subjectLeId = clientLE?.legalEntityId;

    // Load all claims + all source mappings in parallel (2 queries, no waterfall)
    const [allClaims, allSourceMappings] = subjectLeId
        ? await Promise.all([
            prisma.fieldClaim.findMany({
                where: {
                    subjectLeId,
                    status: { in: ['VERIFIED', 'ASSERTED'] },
                    OR: [{ ownerScopeId: ownerScopeId || null }, { ownerScopeId: null }]
                },
                orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
            }),
            (prisma as any).sourceFieldMapping.findMany({
                where: { isActive: true },
                select: { targetFieldNo: true, sourceType: true, sourceReference: true, priority: true }
            })
        ])
        : [[], []] as [any[], any[]];
        
    // Build currentValues for the master field grid (fast in-memory pass)
    const currentValues: Record<number, any> = {};
    if (subjectLeId) {
        const getSourcePriority = (source: string) => {
            if (source === 'GLEIF') return 1;
            if (source === 'REGISTRATION_AUTHORITY') return 2;
            if (source === 'USER_INPUT') return 3;
            if (source === 'AI_EXTRACTION') return 4;
            return 5;
        };

        const fieldGroups: Record<number, any[]> = {};
        for (const c of allClaims) {
            if (!fieldGroups[c.fieldNo]) fieldGroups[c.fieldNo] = [];
            fieldGroups[c.fieldNo].push(c);
        }

        for (const fieldNoStr in fieldGroups) {
            const fieldNo = parseInt(fieldNoStr);
            const fieldClaims = fieldGroups[fieldNo];
            const winner = fieldClaims.sort((a: any, b: any) => {
                const pA = getSourcePriority(a.sourceType);
                const pB = getSourcePriority(b.sourceType);
                if (pA !== pB) return pA - pB;
                const tA = a.assertedAt.getTime();
                const tB = b.assertedAt.getTime();
                if (tA !== tB) return tB - tA;
                return b.id.localeCompare(a.id);
            })[0];

            if (winner && !(winner.valueJson && typeof winner.valueJson === 'object' && (winner.valueJson as any).tombstone)) {
                currentValues[fieldNo] = winner.valueText ?? winner.valueNumber ?? winner.valueDate ?? winner.valueJson ?? winner.valueLeId ?? winner.valuePersonId ?? winner.valueOrgId ?? winner.valueDocId;
            }
        }
    }

    const masterFields = allFields.map((def: any) => ({
        fieldNo: def.fieldNo,
        label: def.fieldName,
        category: def.category,
        dataType: def.appDataType,
        currentValue: currentValues[def.fieldNo]
    })).sort((a: any, b: any) => a.label.localeCompare(b.label));

    const masterGroups = allGroups.map((g: any) => ({
        key: g.key,
        label: g.label,
        category: g.category,
        dataType: 'JSON',
        currentValue: undefined // Groups are complex, skip live preview for now
    })).sort((a: any, b: any) => a.label.localeCompare(b.label));

    // 2. Lookups for categories
    const fieldCategoryMap = new Map(allFields.map((f: any) => [f.fieldNo, f.category]));
    const groupCategoryMap = new Map(allGroups.map((g: any) => [g.key, g.category]));

    // Update questions with categories
    questions.forEach((q: any) => {
        if (q.masterFieldNo) q.masterFieldCategory = fieldCategoryMap.get(q.masterFieldNo);
        if (q.masterQuestionGroupId) q.masterFieldCategory = groupCategoryMap.get(q.masterQuestionGroupId);
        if (q.customFieldDefinitionId) q.masterFieldCategory = "Custom";
    });

    // 3. Get Custom Fields available to this LE (context of owners or current user FI)
    const customFieldsRaw = await prisma.customFieldDefinition.findMany({
        orderBy: { label: 'asc' }
    });
    const customData = (clientLE?.customData as Record<string, any>) || {};
    const customFields = customFieldsRaw.map((f: any) => {
        const valObj = customData[f.id];
        const val = valObj && typeof valObj === 'object' && 'value' in valObj ? valObj.value : valObj;
        return { 
            id: f.id, 
            label: f.label, 
            dataType: f.dataType, 
            currentValue: val 
        };
    });

    // 3. Extract unique filters
    const relationships = Array.from(new Set(questions.map((q: any) => q.engagementOrgName || "Unknown"))).sort();
    const questionnaires = Array.from(new Set(questions.map((q: any) => q.questionnaireName))).sort();

    // 4. Resolve Master Data values for mapped questions using the batch resolver
    // (replaces the N+1 per-question resolveMasterData loop: 76 queries → 0 queries)
    const mappedQuestions = questions.filter((q: any) => q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId);
    if (mappedQuestions.length > 0 && subjectLeId) {
        // Build fieldDefMap from already-loaded allFields
        const fieldDefMap = new Map<number, { fieldNo: number; fieldName: string; appDataType: string; isMultiValue: boolean }>(
            allFields.map((f: any) => [f.fieldNo, { fieldNo: f.fieldNo, fieldName: f.fieldName ?? '', appDataType: f.appDataType, isMultiValue: f.isMultiValue }])
        );

        // Build groupFieldMap from already-loaded allGroupsWithItems
        const groupFieldMap = new Map<string, number[]>(
            allGroupsWithItems.map((g: any) => [g.key, g.fieldNos as number[]])
        );

        const batchInput: BatchResolverInput = {
            subjectLeId,
            ownerScopeId,
            questions: mappedQuestions
                .filter((q: any) => q.masterFieldNo || q.masterQuestionGroupId)
                .map((q: any) => ({
                    questionId: q.id,
                    masterFieldNo: q.masterFieldNo,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                })),
            fieldDefMap,
            groupFieldMap,
            claims: allClaims as any,
            sourceMappings: allSourceMappings,
        };

        const resolvedValues = await resolveMasterDataBatch(batchInput);

        questions.forEach((q: any) => {
            if (q.customFieldDefinitionId) {
                const val = customData[q.customFieldDefinitionId];
                q.masterDataValue = (val && typeof val === 'object' && 'value' in val) ? val.value : val;
                if (val && typeof val === 'object') {
                    q.masterDataSource = val.source || 'USER_INPUT';
                    q.masterDataUpdatedAt = val.timestamp ? new Date(val.timestamp) : null;
                } else {
                    q.masterDataSource = 'USER_INPUT';
                }
            } else if (resolvedValues[q.id]) {
                if (q.masterQuestionGroupId) {
                    const groupMap: Record<string, any> = {};
                    let latestDate: Date | null = null;
                    let primarySource: string | null = null;

                    // Build the ordered per-field list for GroupAnswerRenderer.
                    // Ordering follows the group's fieldNos array (already DB-ordered).
                    const groupFieldNos = groupFieldMap.get(q.masterQuestionGroupId) ?? [];
                    const groupFields: GroupFieldData[] = [];

                    for (const [fNo, fv] of Object.entries(resolvedValues[q.id])) {
                        groupMap[fNo] = fv.value;
                        if (!latestDate || (fv.updatedAt && fv.updatedAt > latestDate)) {
                            latestDate = fv.updatedAt || null;
                            primarySource = fv.source;
                        }
                    }

                    // Populate groupFields in group-item order
                    for (const fieldNo of groupFieldNos) {
                        const def = fieldDefMap.get(fieldNo);
                        if (!def) continue;
                        const hydratedVal = resolvedValues[q.id][String(fieldNo)];
                        const cfg = getComplexFieldConfig(fieldNo);
                        const codeSystem = cfg && 'codeSystem' in cfg ? (cfg as any).codeSystem : undefined;
                        groupFields.push({
                            fieldNo,
                            fieldName: def.fieldName ? `F${fieldNo} ${def.fieldName}` : `F${fieldNo}`,
                            appDataType: def.appDataType,
                            isMultiValue: def.isMultiValue,
                            ...(codeSystem ? { codeSystem } : {}),
                            hydrated: hydratedVal ?? { value: null, source: null, isSynced: false },
                        });
                    }

                    q.masterDataValue = groupMap;           // preserved — backward compat
                    q.masterDataSource = primarySource || 'MASTER_RECORD';
                    q.masterDataUpdatedAt = latestDate;
                    (q as any).masterDataGroupFields = groupFields;
                } else {
                    const fieldValues = Object.values(resolvedValues[q.id]);
                    if (fieldValues.length > 0) {
                        const fv = fieldValues[0];
                        q.masterDataValue = fv.value;
                        q.masterDataSource = fv.source;
                        q.masterDataUpdatedAt = fv.updatedAt;
                    }
                }
            }
        });
    }

    // 5. Get Owner OrgId for Custom Field Creation
    const currentOwner = await prisma.clientLEOwner.findFirst({
        where: { clientLEId: leId, endAt: null },
        select: { partyId: true }
    });
    const ownerOrgId = currentOwner?.partyId;

    return {
        questions,
        masterFields,
        masterGroups,
        customFields,
        relationships,
        questionnaires,
        ownerOrgId
    };
}

/**
 * Updates a question mapping
 */
export async function mapQuestionToField(
    leId: string,
    questionId: string,
    mapping: { fieldNo?: number | null; customFieldId?: string | null; groupId?: string | null }
) {
    try { await ensureQuestionNotReferenceSnapshot(questionId); } catch(e: any) { return { success: false, error: e.message }; }
    try {
        const targetStatus = 'DRAFT';

        await prisma.question.update({
            where: { id: questionId },
            data: {
                masterFieldNo: mapping.fieldNo ?? null,
                masterQuestionGroupId: mapping.groupId ?? null,
                customFieldDefinitionId: mapping.customFieldId ?? null,
                status: targetStatus,
                approvedAt: null,
                approvedByUserId: null,
                approvedMappingConfig: require('@prisma/client').Prisma.JsonNull,
                sharedAt: null,
                sharedByUserId: null
            }
        });

        revalidatePath(`/app/le/${leId}/workbench4`);

        // Resolve the new value immediately to return to client
        let newValue: any = null;
        let newSource: string | null = null;
        let newUpdatedAt: Date | null = null;

        if (mapping.customFieldId) {
            const le = await prisma.clientLE.findUnique({
                where: { id: leId },
                select: { customData: true }
            });
            const customData = (le?.customData as Record<string, any>) || {};
            const val = customData[mapping.customFieldId];
            newValue = (val && typeof val === 'object' && 'value' in val) ? val.value : val;
            if (val && typeof val === 'object') {
                newSource = val.source || "USER_INPUT";
                newUpdatedAt = val.timestamp ? new Date(val.timestamp) : null;
            } else {
                newSource = "USER_INPUT";
            }
        } else if (mapping.fieldNo || mapping.groupId) {
            const resolved = await resolveMasterData(leId, [{
                questionId,
                masterFieldNo: mapping.fieldNo,
                masterQuestionGroupId: mapping.groupId
            }]);
            if (resolved[questionId]) {
                if (mapping.groupId) {
                    const groupMap: Record<string, any> = {};
                    let latestDate: Date | null = null;
                    let primarySource: string | null = null;

                    for (const [fNo, fv] of Object.entries(resolved[questionId])) {
                        groupMap[fNo] = fv.value;
                        if (!latestDate || (fv.updatedAt && fv.updatedAt > latestDate)) {
                            latestDate = fv.updatedAt || null;
                            primarySource = fv.source || "MASTER_RECORD";
                        }
                    }
                    newValue = groupMap;
                    newSource = primarySource;
                    newUpdatedAt = latestDate;
                } else {
                    const fieldValues = Object.values(resolved[questionId]);
                    if (fieldValues.length > 0) {
                        const fv = fieldValues[0];
                        newValue = fv.value;
                        newSource = fv.source;
                        newUpdatedAt = fv.updatedAt || null;
                    }
                }
            }
        }

        return { success: true, newValue, newSource, newUpdatedAt };
    } catch (error) {
        console.error("Failed to map question:", error);
        return { success: false, error: "Database update failed" };
    }
}

/**
 * Uses LLM to find the best semantic matches for a question text
 */
export async function getAISemanticMatch(questionText: string, searchTerm?: string) {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) throw new Error("OPENAI_API_KEY is missing");

        const openai = createOpenAI({ apiKey: key });

        const [allGroups, allFields] = await Promise.all([
            listAllMasterGroups(),
            listAllMasterFields()
        ]);

        // Prepare schema context
        const schemaItems = [
            ...allGroups.map((g: any) => ({ id: `group:${g.key}`, label: g.label, desc: g.description })),
            ...allFields.map((f: any) => ({ id: `master:${f.fieldNo}`, label: f.fieldName, desc: f.notes }))
        ];

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                suggestions: z.array(z.object({
                    id: z.string().describe("The ID of the match starting with 'master:' or 'group:'"),
                    confidence: z.number().describe("Match confidence 0.0 to 1.0"),
                    reasoning: z.string().describe("Briefly why this matches")
                })).max(3)
            }),
            messages: [
                {
                    role: "system",
                    content: "You are an AI mapping assistant. Your task is to match a compliance/KYC question to the most appropriate canonical field in our Master Data Schema."
                },
                {
                    role: "user",
                    content: `QUESTION: "${questionText}"
                    ${searchTerm ? `USER SEARCH TERM: "${searchTerm}"` : ""}
                    
                    MASTER SCHEMA OPTIONS:
                    ${schemaItems.map((s: any) => `- [${s.id}] ${s.label}: ${s.desc || ''}`).join('\n')}
                    
                    Return the top 3 best matching IDs.`
                }
            ]
        });

        // De-duplicate suggestions by ID (AI can sometimes suggest same field twice)
        const uniqueSuggestions = Array.from(
            new Map(object.suggestions.map((s: any) => [s.id, s])).values()
        );

        return { success: true, suggestions: uniqueSuggestions };
    } catch (error) {
        console.error("AI Semantic Match failed:", error);
        return { success: false, error: "AI matching failed" };
    }
}

/**
 * Uses LLM to suggest a compact, descriptive field name for a new custom master data field,
 * based on the original question text.
 */
export async function getAIFieldNameSuggestion(questionText: string) {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) throw new Error("OPENAI_API_KEY is missing");

        const openai = createOpenAI({ apiKey: key });

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: z.object({
                suggestion: z.string().describe("A compact field name, 2-5 words, title case. E.g. 'Board Diversity Policy', 'Primary Business Address', 'Anti-Money Laundering Program'."),
                dataType: z.enum(['Text', 'Boolean', 'Date', 'Number', 'Document']).describe("The most appropriate data type for this field"),
                reasoning: z.string().describe("Brief explanation of why this name and type were chosen")
            }),
            messages: [
                {
                    role: "system",
                    content: "You are a master data schema designer for a KYC/compliance platform. Given a question from a questionnaire, suggest a compact, reusable field name that captures the essence of what data is being collected. The name should be generic enough to apply across different questionnaires asking similar things, but specific enough to be unambiguous. Use Title Case, 2-5 words."
                },
                {
                    role: "user",
                    content: `QUESTION: "${questionText}"\n\nSuggest a compact master data field name, the most appropriate data type, and briefly explain your reasoning.`
                }
            ]
        });

        return { success: true, ...object };
    } catch (error) {
        console.error("AI Field Name Suggestion failed:", error);
        return { success: false, error: "AI suggestion failed" };
    }
}
