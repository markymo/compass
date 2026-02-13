"use server";

import { KycLoader } from "@/services/kyc/KycLoader";
import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups";

const loader = new KycLoader();

export type ResolverRequest = {
    questionId: string;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
};

export type HydratedValue = {
    value: any;
    source: string | null;
    isSynced: boolean; // True if value exists in Master Data
};

export type ResolverResponse = Record<string, Record<string, HydratedValue>>; // QuestionId -> FieldNo -> Value

export async function resolveMasterData(
    leId: string,
    questions: ResolverRequest[]
): Promise<ResolverResponse> {
    const response: ResolverResponse = {};

    // Group by requested fields to optimize? 
    // For now, straightforward iteration.

    for (const q of questions) {
        response[q.questionId] = {};

        // A. Handle Group Mapping
        if (q.masterQuestionGroupId) {
            const group = FIELD_GROUPS[q.masterQuestionGroupId];
            if (group) {
                const results = await loader.loadGroup(leId, q.masterQuestionGroupId, 'CLIENT_LE'); // ID is likely ClientLE ID in this context

                // Map results to { [fieldNo]: HydratedValue }
                for (const fieldNo of group.fieldNos) {
                    const loaded = results[fieldNo];
                    if (loaded && loaded.value !== null) {
                        response[q.questionId][fieldNo] = {
                            value: loaded.value,
                            source: loaded.source,
                            isSynced: true
                        };
                    }
                }
            }
        }
        // B. Handle Single Field Mapping
        else if (q.masterFieldNo) {
            const loaded = await loader.loadField(leId, q.masterFieldNo, 'CLIENT_LE');
            if (loaded && loaded.value !== null) {
                response[q.questionId][q.masterFieldNo] = {
                    value: loaded.value,
                    source: loaded.source,
                    isSynced: true
                };
            }
        }
    }

    return response;
}

// --- Field Detail Inspector (Restored) ---

import prisma from "@/lib/prisma";
import { ProvenanceSource } from "@/domain/kyc/types/ProvenanceTypes";

export interface FieldDetailData {
    current: {
        value: any;
        source: ProvenanceSource;
        timestamp: Date | null;
        confidence: number | null;
    } | null;
    history: any[]; // MasterDataEvent[]
    candidates: any[]; // FieldCandidate[]
}

export async function getFieldDetail(
    entityId: string,
    fieldNo: number,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
): Promise<FieldDetailData> {
    // 1. Get Current Value via KycLoader
    const current = await loader.loadField(entityId, fieldNo, entityType);

    // 2. Get History from MasterDataEvent
    // We need to resolve to LegalEntity ID first because events are linked to LE
    let resolvedLeId = entityId;
    if (entityType === 'CLIENT_LE') {
        const identity = await prisma.identityProfile.findUnique({
            where: { clientLEId: entityId },
            select: { legalEntityId: true }
        });
        if (identity?.legalEntityId) {
            resolvedLeId = identity.legalEntityId;
        } else {
            // If no LE exists, there is no history
            return {
                current: null,
                history: [],
                candidates: []
            };
        }
    }

    const history = await prisma.masterDataEvent.findMany({
        where: {
            legalEntityId: resolvedLeId,
            fieldNo: fieldNo
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    // 3. Get Candidates (Placeholder for now - requires reprocessing EvidenceStore)
    // TODO: Re-implement candidate fetching using EvidenceService.reprocess(evidenceId)
    const candidates: any[] = [];

    return {
        current: current ? {
            value: current.value,
            source: current.source as ProvenanceSource,
            timestamp: current.updatedAt,
            confidence: current.confidence
        } : null,
        history,
        candidates
    };
    return {
        current: current ? {
            value: current.value,
            source: current.source as ProvenanceSource,
            timestamp: current.updatedAt,
            confidence: current.confidence
        } : null,
        history,
        candidates
    };
}

// --- Console Question Fetcher ---

export type ConsoleQuestion = {
    id: string;
    text: string;
    category: string;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
    status: "OPEN" | "ANSWERED";
    questionnaireName: string;
};

export async function getConsoleQuestions(leId: string): Promise<ConsoleQuestion[]> {
    // 1. Find all active Engagements for this ClientLE
    const engagements = await prisma.fIEngagement.findMany({
        where: {
            clientLEId: leId,
            status: { not: 'ARCHIVED' }
        },
        include: {
            // Check both templates and instances
            questionnaires: {
                include: {
                    questions: {
                        where: { isLocked: false }, // Only show active/unlocked questions?
                        orderBy: { order: 'asc' }
                    }
                }
            },
            questionnaireInstances: {
                include: {
                    questions: {
                        where: { isLocked: false },
                        orderBy: { order: 'asc' }
                    }
                }
            }
        }
    });

    const consoleQuestions: ConsoleQuestion[] = [];
    const seenQuestionIds = new Set<string>();

    // 2. Flatten and Map
    for (const eng of engagements) {
        // Process Templates
        for (const qnaire of eng.questionnaires) {
            for (const q of qnaire.questions) {
                if (seenQuestionIds.has(q.id)) continue;
                seenQuestionIds.add(q.id);

                consoleQuestions.push({
                    id: q.id,
                    text: q.text,
                    category: qnaire.name, // Use Questionnaire Name as category for now
                    masterFieldNo: q.masterFieldNo,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    status: q.answer ? "ANSWERED" : "OPEN",
                    questionnaireName: qnaire.name
                });
            }
        }

        // Process Instances (Snapshots)
        // Logic: specific instances might override templates. 
        // For simplicity, we just add them too, assuming they are distinct sets or snapshots.
        for (const qnaire of eng.questionnaireInstances) {
            for (const q of qnaire.questions) {
                if (seenQuestionIds.has(q.id)) continue;
                seenQuestionIds.add(q.id);

                consoleQuestions.push({
                    id: q.id,
                    text: q.text,
                    category: qnaire.name,
                    masterFieldNo: q.masterFieldNo,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    status: q.answer ? "ANSWERED" : "OPEN",
                    questionnaireName: qnaire.name
                });
            }
        }
    }

    return consoleQuestions;
}
