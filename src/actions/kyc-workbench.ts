"use server";

import prisma from "@/lib/prisma";
import { getConsoleQuestions, ConsoleQuestion, resolveMasterData } from "./kyc-query";
import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";
import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups";
import { revalidatePath } from "next/cache";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export interface Workbench4Data {
    questions: ConsoleQuestion[];
    masterFields: Array<{ fieldNo: number; label: string }>;
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
    const questions = await getConsoleQuestions(leId);

    // 1. Get standard Master Fields
    const masterFields = Object.values(FIELD_DEFINITIONS).map(def => ({
        fieldNo: def.fieldNo,
        label: def.fieldName
    })).sort((a, b) => a.label.localeCompare(b.label));

    // 2. Get Custom Fields available to this LE (context of owners or current user FI)
    // For simplicity, we fetch all custom fields linked to this LE's questionnaire questions
    // or we could fetch based on Org context like getFullMasterData does.
    const customFieldsRaw = await prisma.customFieldDefinition.findMany({
        orderBy: { label: 'asc' }
    });
    const customFields = customFieldsRaw.map(f => ({ id: f.id, label: f.label }));

    // 3. Extract unique filters
    const relationships = Array.from(new Set(questions.map(q => q.engagementOrgName || "Unknown"))).sort();
    const questionnaires = Array.from(new Set(questions.map(q => q.questionnaireName))).sort();

    // 4. Resolve Master Data values for all mapped questions
    const mappedQuestions = questions.filter(q => q.masterFieldNo || q.masterQuestionGroupId || q.customFieldDefinitionId);
    if (mappedQuestions.length > 0) {
        const resolverRequests = mappedQuestions
            .filter(q => q.masterFieldNo || q.masterQuestionGroupId)
            .map(q => ({
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

        questions.forEach(q => {
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
                const fieldValues = Object.values(resolvedValues[q.id]);
                if (fieldValues.length > 0) {
                    const fv = fieldValues[0];
                    q.masterDataValue = fv.value;
                    q.masterDataSource = fv.source;
                    q.masterDataUpdatedAt = fv.updatedAt;
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
        await prisma.question.update({
            where: { id: questionId },
            data: {
                masterFieldNo: mapping.fieldNo ?? null,
                masterQuestionGroupId: mapping.groupId ?? null,
                customFieldDefinitionId: mapping.customFieldId ?? null
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
            const fieldValues = Object.values(resolved[questionId] || {});
            if (fieldValues.length > 0) {
                const fv = fieldValues[0];
                newValue = fv.value;
                newSource = fv.source;
                newUpdatedAt = fv.updatedAt || null;
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

        // Prepare schema context
        const schemaItems = [
            ...Object.values(FIELD_GROUPS).map(g => ({ id: `group:${g.id}`, label: g.label, desc: g.description })),
            ...Object.values(FIELD_DEFINITIONS).map(f => ({ id: `master:${f.fieldNo}`, label: f.fieldName, desc: f.notes }))
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
                    ${schemaItems.map(s => `- [${s.id}] ${s.label}: ${s.desc || ''}`).join('\n')}
                    
                    Return the top 3 best matching IDs.`
                }
            ]
        });

        return { success: true, suggestions: object.suggestions };
    } catch (error) {
        console.error("AI Semantic Match failed:", error);
        return { success: false, error: "AI matching failed" };
    }
}
