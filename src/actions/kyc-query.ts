"use server";

import { KycStateService } from "@/lib/kyc/KycStateService";
import { getMasterFieldDefinition, getMasterFieldGroup } from "@/services/masterData/definitionService";
import { ProvenanceSource } from "@/domain/kyc/types/ProvenanceTypes";
import prisma from "@/lib/prisma";

// KycLoader is deprecated in favor of KycStateService

export type ResolverRequest = {
    questionId: string;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
};

export type HydratedValue = {
    value: any;
    source: string | null;
    updatedAt?: Date | null;
    isSynced: boolean; // True if value exists in Master Data
};

export type ResolverResponse = Record<string, Record<string, HydratedValue>>; // QuestionId -> FieldNo -> Value

export async function resolveMasterData(
    leId: string,
    questions: ResolverRequest[]
): Promise<ResolverResponse> {
    const response: ResolverResponse = {};

    // 0. Resolve Subject and Scope
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: leId }
    });
    const subjectLeId = clientLE?.legalEntityId;
    const ownerScopeId = await KycStateService.resolveScopeId(leId);

    for (const q of questions) {
        response[q.questionId] = {};

        // A. Handle Group Mapping
        if (q.masterQuestionGroupId) {
            try {
                const group = await getMasterFieldGroup(q.masterQuestionGroupId);
                if (subjectLeId) {
                    for (const item of group.items) {
                        const fieldNo = item.fieldNo;
                        const def = await getMasterFieldDefinition(fieldNo);
                        if (def.isMultiValue) {
                            const collection = await KycStateService.getAuthoritativeCollection(
                                { subjectLeId },
                                fieldNo,
                                ownerScopeId || undefined
                            );
                            if (collection.length > 0) {
                                response[q.questionId][fieldNo] = {
                                    value: collection.map(c => c.value),
                                    source: collection[0].isScoped ? 'USER_INPUT' : (collection[0].evidenceProvider || 'MASTER_RECORD'),
                                    updatedAt: collection[0].assertedAt,
                                    isSynced: true
                                };
                            }
                        } else {
                            const derived = await KycStateService.getAuthoritativeValue(
                                { subjectLeId },
                                fieldNo,
                                ownerScopeId || undefined
                            );

                            if (derived) {
                                response[q.questionId][fieldNo] = {
                                    value: derived.value,
                                    source: derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || 'MASTER_RECORD'),
                                    updatedAt: derived.assertedAt,
                                    isSynced: true
                                };
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`[resolveMasterData] Group ${q.masterQuestionGroupId} not found or inactive.`);
            }
        }
        // B. Handle Single Field Mapping
        else if (q.masterFieldNo && subjectLeId) {
            const def = await getMasterFieldDefinition(q.masterFieldNo);
            if (def.isMultiValue) {
                const collection = await KycStateService.getAuthoritativeCollection(
                    { subjectLeId },
                    q.masterFieldNo,
                    ownerScopeId || undefined
                );
                if (collection.length > 0) {
                    const vals = collection.map(c => c.value);
                    console.log(`[resolveMasterData] Field ${q.masterFieldNo} is multi-value. Values:`, vals);
                    response[q.questionId][q.masterFieldNo] = {
                        value: vals,
                        source: collection[0].isScoped ? 'USER_INPUT' : (collection[0].evidenceProvider || 'MASTER_RECORD'),
                        updatedAt: collection[0].assertedAt,
                        isSynced: true
                    };
                }
            } else {
                const derived = await KycStateService.getAuthoritativeValue(
                    { subjectLeId },
                    q.masterFieldNo,
                    ownerScopeId || undefined
                );

                if (derived) {
                    response[q.questionId][q.masterFieldNo] = {
                        value: derived.value,
                        source: derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || 'MASTER_RECORD'),
                        updatedAt: derived.assertedAt,
                        isSynced: true
                    };
                }
            }
        }
    }

    return response;
}

// --- Field Detail Inspector (Restored) ---

export interface FieldDetailData {
    fieldNo?: number;
    fieldName?: string;
    isRepeating: boolean;
    dataType: string;
    category?: string;
    modelField?: string;
    options?: string[];
    notes?: string;
    userNote?: string | null;
    current: {
        value: any;
        source: ProvenanceSource;
        timestamp: Date | null;
        confidence: number | null;
        sourceReference?: string;
    } | null;
    assignment: {
        id: string;
        assignedToUserId: string;
        assignedByUserId: string;
        assignedUser?: { name: string | null; email: string };
        createdAt: Date;
    } | null;
    history: any[]; // Lineage will be derived from FieldClaims
    candidates: any[]; // FieldCandidate[]
    rows?: { id: string; value: any; source: string; timestamp: Date; instanceId?: string; collectionId?: string; data?: any; label?: string; sourceReference?: string }[];
}

export async function getFieldDetail(
    entityId: string,
    fieldNo: number,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY',
    customFieldId?: string,
    masterQuestionGroupId?: string
): Promise<FieldDetailData> {

    // --- Master Question Group Path ---
    if (masterQuestionGroupId) {
        let subjectLeId = entityId;
        let ownerScopeId: string | undefined = undefined;

        if (entityType === 'CLIENT_LE') {
            const clientLE = await prisma.clientLE.findUnique({
                where: { id: entityId }
            });
            subjectLeId = clientLE?.legalEntityId || "";
            ownerScopeId = (await KycStateService.resolveScopeId(entityId)) || undefined;
        }

        if (!subjectLeId) {
            throw new Error("Could not resolve LegalEntity subject for this request.");
        }

        try {
            const group = await getMasterFieldGroup(masterQuestionGroupId);
            const groupValues: Record<string, any> = {};

            let latestTimestamp = new Date(0);

            for (const item of group.items) {
                const def = await getMasterFieldDefinition(item.fieldNo);
                if (def.isMultiValue) {
                    const collection = await KycStateService.getAuthoritativeCollection({ subjectLeId }, item.fieldNo, ownerScopeId);
                    if (collection.length > 0) {
                        groupValues[def.fieldName] = collection.map(c => c.value);
                        if (collection[0].assertedAt > latestTimestamp) latestTimestamp = collection[0].assertedAt;
                    }
                } else {
                    const derived = await KycStateService.getAuthoritativeValue({ subjectLeId }, item.fieldNo, ownerScopeId);
                    if (derived) {
                        groupValues[def.fieldName] = derived.value;
                        if (derived.assertedAt > latestTimestamp) latestTimestamp = derived.assertedAt;
                    }
                }
            }

            return {
                fieldNo: 0,
                fieldName: group.label,
                category: "Master Data Group",
                isRepeating: false,
                dataType: "JSON",
                current: {
                    value: Object.keys(groupValues).length > 0 ? groupValues : null,
                    source: "MULTI_SOURCE" as any,
                    timestamp: latestTimestamp.getTime() > 0 ? latestTimestamp : new Date(),
                    confidence: 1.0
                },
                assignment: null,
                history: [],
                candidates: []
            };
        } catch (e) {
            console.warn(`[getFieldDetail] Error fetching group data:`, e);
            // Fallback to minimal return object if group fails
            return {
                fieldNo: 0,
                fieldName: "Unknown Group",
                isRepeating: false,
                dataType: "JSON",
                current: null,
                assignment: null,
                history: [],
                candidates: []
            };
        }
    }

    // --- Custom Field Path ---
    if (customFieldId) {
        // Fetch ClientLE directly
        const le = await prisma.clientLE.findUnique({
            where: { id: entityId },
            select: { customData: true }
        });

        if (!le) throw new Error("Entity not found");

        // Fetch the CustomFieldDefinition to get the label
        const customDef = await prisma.customFieldDefinition.findUnique({
            where: { id: customFieldId },
            select: { label: true, dataType: true }
        });

        const data = (le.customData as Record<string, any>) || {};
        const val = data[customFieldId]; // Expecting { value, source, timestamp } or just value

        let currentVal = val;
        let source: ProvenanceSource = "USER_INPUT";
        let timestamp = new Date(); // Default if not tracked

        if (val && typeof val === 'object' && 'value' in val) {
            currentVal = val.value;
            source = (val.source as ProvenanceSource) || "USER_INPUT";
            timestamp = val.timestamp ? new Date(val.timestamp) : new Date();
        }

        return {
            fieldNo: 0, // Custom fields don't have a fieldNo
            fieldName: customDef?.label || customFieldId,
            isRepeating: false,
            dataType: customDef?.dataType || 'text',
            current: {
                value: currentVal,
                source,
                timestamp,
                confidence: 1.0
            },
            assignment: null,
            history: [], // No history for custom fields yet (schema limitation)
            candidates: []
        };
    }

    // --- Standard Field Path ---
    const def = await getMasterFieldDefinition(fieldNo);

    // 0. Resolve Subject and Scope
    let subjectLeId = entityId;
    let ownerScopeId: string | undefined = undefined;

    if (entityType === 'CLIENT_LE') {
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: entityId }
        });
        subjectLeId = clientLE?.legalEntityId || "";
        ownerScopeId = (await KycStateService.resolveScopeId(entityId)) || undefined;
    }

    if (!subjectLeId) {
        throw new Error("Could not resolve LegalEntity subject for this request.");
    }

    // 1. Get Current Value via KycStateService
    const derived = await KycStateService.getAuthoritativeValue({ subjectLeId }, fieldNo, ownerScopeId);

    // 2. Load Rows if repeating
    let rows: { id: string; value: any; source: string; timestamp: Date; instanceId?: string; collectionId?: string; data?: any }[] | undefined = undefined;

    if (def?.isMultiValue) {
        const collection = await KycStateService.getAuthoritativeCollection({ subjectLeId }, fieldNo, ownerScopeId);

        rows = collection.map(c => {
            return {
                id: c.claimId,
                value: c.value,
                source: c.isScoped ? 'USER_INPUT' : (c.evidenceProvider || 'SYSTEM'),
                sourceReference: c.sourceReference || undefined,
                timestamp: c.assertedAt,
                instanceId: c.instanceId,
                collectionId: c.collectionId,
                data: undefined,
                label: typeof c.value === 'string' ? c.value : undefined
            };
        });
    }

    // 2. Get History (Lineage) - Force re-bundle for new Prisma client
    const claims = await prisma.fieldClaim.findMany({
        where: {
            fieldNo,
            subjectLeId: subjectLeId,
            OR: [
                { ownerScopeId: null },
                { ownerScopeId: ownerScopeId }
            ]
        },
        include: {
            verifiedBy: {
                select: { name: true, email: true }
            }
        },
        orderBy: { assertedAt: 'desc' },
        take: 20
    });

    const history = claims.map((c: any) => ({
        id: c.id,
        newValue: (c.valueText ?? c.valueNumber ?? c.valueDate ?? c.valueJson ?? c.valueLeId ?? c.valuePersonId ?? c.valueOrgId ?? c.valueDocId) ?? null,
        source: c.sourceType,
        timestamp: c.assertedAt,
        actorId: c.verifiedBy?.name || c.verifiedBy?.email || "System",
        actor: c.sourceReference, // Use sourceReference for reference detail (reason/LEI)
        status: c.status,
        isScoped: c.ownerScopeId !== null
    }));

    // 3. Get Candidates (Placeholder for now)
    const candidates: any[] = [];

    // 4. Get Current Assignment
    const [assignment, noteRecord] = await Promise.all([
        prisma.masterFieldAssignment.findUnique({
            where: {
                clientLEId_fieldNo: {
                    clientLEId: entityId,
                    fieldNo: fieldNo
                }
            },
            include: {
                assignedUser: {
                    select: { name: true, email: true }
                }
            }
        }),
        // Manual SQL fallback because Prisma client model property might be missing from runtime cache in dev
        prisma.$queryRaw<any[]>`SELECT text FROM master_field_notes WHERE "clientLEId" = ${entityId} AND "fieldNo" = ${fieldNo} LIMIT 1`
    ]);

    const noteText = noteRecord?.[0]?.text || null;

    return {
        fieldNo,
        fieldName: def?.fieldName,
        isRepeating: def?.isMultiValue || false,
        dataType: def?.appDataType || 'string',
        category: def?.category || undefined,
        modelField: (def as any).modelField || undefined, // We'll need to check how this is stored in DB
        options: def?.options || [],
        notes: def?.notes || undefined,
        current: derived ? {
            value: def?.isMultiValue && rows ? rows.map(r => r.value) : derived.value,
            source: (derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || 'SYSTEM')) as ProvenanceSource,
            sourceReference: derived.sourceReference || undefined,
            timestamp: derived.assertedAt,
            confidence: derived.confidenceScore || 1.0
        } : null,
        assignment: assignment ? {
            id: assignment.id,
            assignedToUserId: assignment.assignedToUserId,
            assignedByUserId: assignment.assignedByUserId,
            assignedUser: assignment.assignedUser,
            createdAt: assignment.createdAt
        } : null,
        userNote: noteText,
        history,
        candidates,
        rows
    };
}

// --- Console Question Fetcher ---

export interface ConsoleQuestion {
    id: string;
    text: string;
    category: string;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
    customFieldDefinitionId?: string | null;
    status: string;
    questionnaireName: string;
    answer?: string | null;
    engagementOrgName?: string;
    masterDataValue?: any;
    masterDataSource?: string | null;
    masterDataUpdatedAt?: Date | null;
    masterFieldCategory?: string | null;
    isLocked?: boolean;
    approvedAt?: Date | null;
    releasedAt?: Date | null;
};

export async function getConsoleQuestions(leId: string, includeLocked: boolean = false): Promise<ConsoleQuestion[]> {
    // 1. Find all active Engagements for this ClientLE
    const engagements = await prisma.fIEngagement.findMany({
        where: {
            clientLEId: leId,
            status: { not: 'ARCHIVED' }
        },
        include: {
            org: {
                select: { name: true }
            },
            questionnaires: {
                include: {
                    questions: {
                        where: includeLocked ? undefined : { isLocked: false },
                        orderBy: { order: 'asc' }
                    }
                }
            },
            questionnaireInstances: {
                include: {
                    questions: {
                        where: includeLocked ? undefined : { isLocked: false },
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
            for (const qRaw of qnaire.questions) {
                const q = qRaw as any;
                if (seenQuestionIds.has(q.id)) continue;
                seenQuestionIds.add(q.id);

                consoleQuestions.push({
                    id: q.id,
                    text: q.text,
                    category: qnaire.name,
                    masterFieldNo: q.masterFieldNo,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    customFieldDefinitionId: q.customFieldDefinitionId,
                    status: q.status || (q.answer ? "ANSWERED" : "OPEN"),
                    questionnaireName: qnaire.name,
                    answer: q.answer,
                    engagementOrgName: eng.org.name,
                    isLocked: q.isLocked,
                    approvedAt: q.approvedAt,
                    releasedAt: q.releasedAt
                });
            }
        }

        // Process Instances (Snapshots)
        for (const qnaire of eng.questionnaireInstances) {
            for (const qRaw of qnaire.questions) {
                const q = qRaw as any;
                if (seenQuestionIds.has(q.id)) continue;
                seenQuestionIds.add(q.id);

                consoleQuestions.push({
                    id: q.id,
                    text: q.text,
                    category: qnaire.name,
                    masterFieldNo: q.masterFieldNo,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    customFieldDefinitionId: q.customFieldDefinitionId,
                    status: q.status || (q.answer ? "ANSWERED" : "OPEN"),
                    questionnaireName: qnaire.name,
                    answer: q.answer,
                    engagementOrgName: eng.org.name,
                    isLocked: q.isLocked,
                    approvedAt: q.approvedAt,
                    releasedAt: q.releasedAt
                });
            }
        }
    }

    return consoleQuestions;
}



// --- User Assignments Aggregator ---

export interface UserAssignmentAgg {
    questions: {
        id: string;
        text: string;
        status: string;
        questionnaireName: string;
        engagementOrgName?: string;
        clientLEId?: string;
        engagementId?: string;
        assignedByUserName?: string;
        createdAt: Date;
    }[];
    masterFields: {
        id: string;
        fieldNo: number;
        fieldName: string;
        category?: string;
        status: 'DRAFT' | 'APPROVED' | 'SHARED' | 'RELEASED';
        clientLEId: string;
        engagementOrgName?: string;
        assignedByUserName?: string;
        createdAt: Date;
    }[];
}

export async function getUserAssignments(userId: string): Promise<UserAssignmentAgg> {
    const questionsRaw = await prisma.question.findMany({
        where: {
            assignedToUserId: userId,
            status: { not: "APPROVED" },
            questionnaire: { isDeleted: false }
        },
        include: {
            questionnaire: {
                include: {
                    engagements: { include: { org: true } },
                    fiEngagement: { include: { org: true } }
                }
            },
            assignedToUser: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const questions = questionsRaw.map((q: any) => {
        let orgName = "Unknown Org";
        let leId = undefined;
        let engId = undefined;

        const m2mEng = q.questionnaire?.engagements?.[0];
        const dirEng = q.questionnaire?.fiEngagement;

        if (dirEng) {
            orgName = dirEng.org?.name || orgName;
            leId = dirEng.clientLEId;
            engId = dirEng.id;
        } else if (m2mEng) {
            orgName = m2mEng.org?.name || orgName;
            leId = m2mEng.clientLEId;
            engId = m2mEng.id;
        }

        return {
            id: q.id,
            text: q.text,
            status: q.status,
            questionnaireName: q.questionnaire?.name || "Unknown Questionnaire",
            engagementOrgName: orgName,
            clientLEId: leId,
            engagementId: engId,
            assignedByUserName: q.assignedToUser?.name || q.assignedToUser?.email || "System",
            createdAt: q.createdAt
        };
    });

    const fieldsRaw = await prisma.masterFieldAssignment.findMany({
        where: { assignedToUserId: userId },
        include: {
            clientLE: {
                include: {
                    fiEngagements: { include: { org: true }, take: 1 }
                }
            },
            assignedUser: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const masterFields = await Promise.all(fieldsRaw.map(async (f: any) => {
        const fieldNo = parseInt(f.fieldNo.toString());
        let fieldName = `Field ${fieldNo}`;
        try {
            const def = await getMasterFieldDefinition(fieldNo);
            fieldName = def.fieldName;
        } catch (e) { }

        const eng = f.clientLE?.fiEngagements?.[0];
        const orgName = eng?.org?.name || "Workspace";

        return {
            id: f.id,
            fieldNo: f.fieldNo,
            fieldName,
            clientLEId: f.clientLEId,
            engagementOrgName: orgName,
            assignedByUserName: f.assignedUser?.name || f.assignedUser?.email || "System",
            createdAt: f.createdAt,
            status: 'DRAFT' as const
        };
    }));

    return { questions, masterFields };
}

export async function getUserAssignmentCount(userId: string): Promise<number> {
    const [qCount, fCount] = await Promise.all([
        prisma.question.count({
            where: {
                assignedToUserId: userId,
                status: { not: "APPROVED" },
                questionnaire: { isDeleted: false }
            }
        }),
        prisma.masterFieldAssignment.count({
            where: { assignedToUserId: userId }
        })
    ]);
    return qCount + fCount;
}
