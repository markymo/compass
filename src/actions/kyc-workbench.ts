"use server";

import prisma from "@/lib/prisma";
import { getConsoleQuestions, ConsoleQuestion, resolveMasterData } from "./kyc-query";
import { listAllMasterFields, listAllMasterGroups, getMasterFieldGroup } from "@/services/masterData/definitionService";
import { revalidatePath } from "next/cache";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export interface Workbench4Data {
    questions: ConsoleQuestion[];
    masterFields: Array<{ fieldNo: number; label: string; category?: string | null }>;
    masterGroups: Array<{ key: string; label: string; category?: string | null }>;
    customFields: Array<{ id: string; label: string }>;
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

    // 1. Get standard Master Fields & Groups
    const [allFields, allGroups] = await Promise.all([
        listAllMasterFields(),
        listAllMasterGroups()
    ]);

    const masterFields = allFields.map((def: any) => ({
        fieldNo: def.fieldNo,
        label: def.fieldName,
        category: def.category
    })).sort((a: any, b: any) => a.label.localeCompare(b.label));

    const masterGroups = allGroups.map((g: any) => ({
        key: g.key,
        label: g.label,
        category: g.category // Groups might have categories too
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
    const customFields = customFieldsRaw.map((f: any) => ({ id: f.id, label: f.label }));

    // 3. Extract unique filters
    const relationships = Array.from(new Set(questions.map((q: any) => q.engagementOrgName || "Unknown"))).sort();
    const questionnaires = Array.from(new Set(questions.map((q: any) => q.questionnaireName))).sort();

    // 4. Resolve Master Data values for all mapped questions
    const mappedQuestions = questions.filter((q: any) => q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId);
    if (mappedQuestions.length > 0) {
        const resolverRequests = mappedQuestions
            .filter((q: any) => q.masterFieldNo || q.masterQuestionGroupId)
            .map((q: any) => ({
                questionId: q.id,
                masterFieldNo: q.masterFieldNo,
                masterQuestionGroupId: q.masterQuestionGroupId
            }));

        const resolvedValues = await resolveMasterData(leId, resolverRequests);

        const le = await prisma.clientLE.findUnique({
            where: { id: leId },
            select: { customData: true }
        });
        const customData = (le?.customData as Record<string, any>) || {};

        questions.forEach((q: any) => {
            if (q.customFieldDefinitionId) {
                const val = customData[q.customFieldDefinitionId];
                q.masterDataValue = (val && typeof val === 'object' && 'value' in val) ? val.value : val;
                if (val && typeof val === 'object') {
                    q.masterDataSource = val.source || "USER_INPUT";
                    q.masterDataUpdatedAt = val.timestamp ? new Date(val.timestamp) : null;
                } else {
                    q.masterDataSource = "USER_INPUT";
                }
            } else if (resolvedValues[q.id]) {
                if (q.masterQuestionGroupId) {
                    // For groups, we want the whole map of fieldNo -> {value, source, ...}
                    // But for simplicity in the current UI, we'll map it to a simpler map of fieldNo -> value
                    const groupMap: Record<string, any> = {};
                    let latestDate: Date | null = null;
                    let primarySource: string | null = null;

                    for (const [fNo, fv] of Object.entries(resolvedValues[q.id])) {
                        groupMap[fNo] = fv.value;
                        if (!latestDate || (fv.updatedAt && fv.updatedAt > latestDate)) {
                            latestDate = fv.updatedAt || null;
                            primarySource = fv.source;
                        }
                    }

                    q.masterDataValue = groupMap;
                    q.masterDataSource = primarySource || "MASTER_RECORD";
                    q.masterDataUpdatedAt = latestDate;
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
