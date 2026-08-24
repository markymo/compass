import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import * as crypto from "crypto";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getFieldDetail, enrichPartyReferences, enrichAddressReferences, resolveMasterDataBatch } from "@/actions/kyc-query";
import { getMasterFieldGroup, getMasterFieldDefinition } from "@/services/masterData/definitionService";
import { buildPartyFieldProjection, extractCanonicalPartyIds } from "@/lib/master-data/party-value";
import { isFieldPermittedByCatalogue } from "@/lib/master-data/party-display-catalogue";
import { CCPartyDocumentService } from "@/lib/documents/party/CCPartyDocumentService";

export interface CreateSubmissionInput {
    questionnaireId: string;
    relationshipId: string;   // FIEngagement ID
    clientLEId: string;
    submittedById: string;
}

export interface SubmissionServiceResult {
    success: boolean;
    submissionId?: string;
    versionNumber?: number;      // Definition Version Number
    submissionNumber?: number;   // Submission Number for this version + relationship
    error?: string;
}

/**
 * Computes a deterministic SHA-256 fingerprint for a questionnaire's structural definition.
 */
export async function computeDefinitionFingerprint(questionnaireId: string): Promise<string> {
    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { name: true, description: true }
    });

    const questions = await prisma.question.findMany({
        where: { questionnaireId },
        orderBy: { order: 'asc' },
        select: {
            id: true,
            text: true,
            compactText: true,
            order: true,
            sourceSectionId: true,
            masterFieldNo: true,
            masterQuestionGroupId: true,
            masterFieldProjectionPath: true,
            expectedDataType: true,
            allowAttachments: true,
        }
    });

    const parts = [
        questionnaire?.name || "",
        questionnaire?.description || "",
        ...questions.map((q: any) => [
            q.text,
            q.compactText || "",
            q.order,
            q.sourceSectionId || "",
            q.masterFieldNo ?? "",
            q.masterQuestionGroupId || "",
            q.masterFieldProjectionPath || "",
            q.expectedDataType,
            q.allowAttachments ? "1" : "0"
        ].join(":"))
    ];

    return crypto.createHash("sha256").update(parts.join("||")).digest("hex");
}

/**
 * Retrieves the current frozen definition version if fingerprint matches,
 * or freezes a new QuestionnaireDefinitionVersion + QuestionDefinitionSnapshots atomically.
 */
export async function getOrCreateDefinitionVersion(
    tx: Prisma.TransactionClient,
    questionnaireId: string
) {
    const fingerprint = await computeDefinitionFingerprint(questionnaireId);

    const latest = await tx.questionnaireDefinitionVersion.findFirst({
        where: { questionnaireId },
        orderBy: { versionNumber: 'desc' },
        include: { questionSnapshots: { orderBy: { order: 'asc' } } }
    });

    if (latest && latest.definitionFingerprint === fingerprint) {
        return latest;
    }

    const count = await tx.questionnaireDefinitionVersion.count({
        where: { questionnaireId }
    });

    const questionnaire = await tx.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { name: true, description: true }
    });

    const liveQuestions = await tx.question.findMany({
        where: { questionnaireId },
        orderBy: { order: 'asc' }
    });

    const versionNumber = count + 1;

    const defVersion = await tx.questionnaireDefinitionVersion.create({
        data: {
            questionnaireId,
            versionNumber,
            definitionFingerprint: fingerprint,
            titleSnapshot: questionnaire?.name || "Untitled Questionnaire",
            descriptionSnapshot: questionnaire?.description || null,
            questionCount: liveQuestions.length,
            questionSnapshots: {
                create: liveQuestions.map(q => ({
                    sourceQuestionId: q.id,
                    questionText: q.text,
                    compactText: q.compactText,
                    order: q.order,
                    sourceSectionId: q.sourceSectionId,
                    masterFieldNo: q.masterFieldNo,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    masterFieldProjectionPath: q.masterFieldProjectionPath,
                    expectedDataType: q.expectedDataType,
                    allowAttachments: q.allowAttachments,
                }))
            }
        },
        include: { questionSnapshots: { orderBy: { order: 'asc' } } }
    });

    return defVersion;
}

/**
 * Creates an immutable QuestionnaireSubmission + SubmissionAnswers.
 */
export async function createQuestionnaireSubmission(
    input: CreateSubmissionInput
): Promise<SubmissionServiceResult> {
    const { questionnaireId, relationshipId, clientLEId, submittedById } = input;

    try {
        // 1. Context validation
        const engagement = await prisma.fIEngagement.findFirst({
            where: { id: relationshipId, clientLEId, isDeleted: false }
        });

        if (!engagement) {
            return { success: false, error: "Invalid relationship or client LE context." };
        }

        const user = await prisma.user.findUnique({ where: { id: submittedById } });
        if (!user) {
            return { success: false, error: "Invalid user." };
        }

        // 2. Fetch subjectLeId & ownerScopeId for canonical resolution
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { id: true, legalEntityId: true }
        });
        const subjectLeId = clientLE?.legalEntityId || undefined;
        const ownerScopeId = await KycStateService.resolveScopeId(clientLEId);

        // 3. Perform canonical answer resolution & reference enrichment BEFORE starting DB transaction
        const liveQuestions = await prisma.question.findMany({
            where: { questionnaireId },
            orderBy: { order: 'asc' },
            include: { documents: { where: { isDeleted: false } } }
        });

        // Resolve all canonical values
        const resolvedAnswerMap = new Map<string, {
            valueJson: any;
            explicitNone: boolean;
            provenanceJson: any;
            documentIds: string[];
        }>();

        for (const q of liveQuestions) {
            let valueJson: any = null;
            let explicitNone = false;
            let provenanceJson: any = null;
            const documentIds: string[] = q.documents.map((d: any) => d.id);

            if (q.masterFieldNo) {
                const derived = await KycStateService.getAuthoritativeValue(
                    { subjectLeId, clientLEId },
                    q.masterFieldNo,
                    ownerScopeId || undefined,
                    undefined
                );

                if (derived) {
                    if (derived.value !== null && derived.value !== undefined && derived.value !== "") {
                        valueJson = derived.value;
                        if (typeof valueJson === 'object' && !Array.isArray(valueJson) && valueJson.explicitNone === true) {
                            explicitNone = true;
                            valueJson = null;
                        }
                    } else {
                        explicitNone = derived.value?.explicitNone === true;
                    }

                    provenanceJson = {
                        claimId: derived.claimId,
                        sourceType: derived.sourceType,
                        sourceReference: derived.sourceReference || null,
                        assertedAt: derived.assertedAt?.toISOString() || null,
                        sourceCheckedAt: derived.sourceCheckedAt?.toISOString() || null,
                    };
                }
            } else if (q.masterQuestionGroupId) {
                const group = await getMasterFieldGroup(q.masterQuestionGroupId);
                if (group && group.items && group.items.length > 0) {
                    const fieldNos = group.items.map((i: any) => i.fieldNo);

                    const fieldDefMap = new Map();
                    for (const item of group.items) {
                        const def = await getMasterFieldDefinition(item.fieldNo);
                        if (def) fieldDefMap.set(def.fieldNo, def);
                    }

                    const [claims, sourceMappings] = await Promise.all([
                        prisma.fieldClaim.findMany({
                            where: {
                                subjectLeId: subjectLeId || '',
                                fieldNo: { in: fieldNos },
                                claimRole: 'VALUE',
                                status: { in: ['VERIFIED', 'ASSERTED'] },
                                OR: [{ ownerScopeId: ownerScopeId || null }, { ownerScopeId: null }]
                            },
                            orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }]
                        }),
                        prisma.sourceFieldMapping.findMany({
                            where: { targetFieldNo: { in: fieldNos }, isActive: true }
                        })
                    ]);

                    const groupFieldMap = new Map();
                    groupFieldMap.set(q.masterQuestionGroupId, fieldNos);

                    const resolvedBatch = await resolveMasterDataBatch({
                        subjectLeId: subjectLeId || '',
                        ownerScopeId: ownerScopeId ?? null,
                        questions: [{ questionId: q.id, masterQuestionGroupId: q.masterQuestionGroupId, masterFieldProjectionPath: q.masterFieldProjectionPath }],
                        fieldDefMap,
                        groupFieldMap,
                        claims: claims as any,
                        sourceMappings,
                        attachmentsByField: undefined,
                        provenanceMap: null,
                    });

                    const groupResult = resolvedBatch[q.id];
                    if (groupResult && Object.keys(groupResult).length > 0) {
                        valueJson = groupResult;
                    }
                }
            } else if (q.answer) {
                valueJson = q.answer;
                if (typeof valueJson === 'object' && !Array.isArray(valueJson) && valueJson.explicitNone === true) {
                    explicitNone = true;
                    valueJson = null;
                }
                provenanceJson = {
                    sourceType: "USER_INPUT",
                    sourceLabel: user.name || user.email,
                    submittedAt: new Date().toISOString()
                };
            }

            // Enrich graph references (PARTY_REF, ADDRESS_REF) in-place so snapshot is self-contained
            if (valueJson) {
                const valuesToEnrich = Array.isArray(valueJson) ? valueJson : [valueJson];
                await enrichPartyReferences(valuesToEnrich);
                await enrichAddressReferences(valuesToEnrich);

                if (q.masterFieldNo) {
                    const masterFieldDef = await getMasterFieldDefinition(q.masterFieldNo);
                    const mask = (masterFieldDef as any)?.profileConfig?.displayMask;

                    const projected = Array.isArray(valueJson)
                        ? valueJson.map(v => buildPartyFieldProjection(v, mask))
                        : buildPartyFieldProjection(valueJson, mask);
                    valueJson = projected;

                    const permitsPartyDocs = isFieldPermittedByCatalogue('party.documents', mask);
                    if (permitsPartyDocs) {
                        const partyIds = extractCanonicalPartyIds(valueJson);
                        if (partyIds.length > 0) {
                            const partyDocsMap = await CCPartyDocumentService.resolvePartyDocumentsBatch(partyIds, clientLEId);
                            for (const docs of Array.from(partyDocsMap.values())) {
                                for (const d of docs) {
                                    if (d.documentId && !documentIds.includes(d.documentId)) {
                                        documentIds.push(d.documentId);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            resolvedAnswerMap.set(q.id, {
                valueJson,
                explicitNone,
                provenanceJson,
                documentIds
            });
        }

        // 4. Atomic Database Transaction
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const defVersion = await getOrCreateDefinitionVersion(tx, questionnaireId);

            const lastSub = await tx.questionnaireSubmission.findFirst({
                where: {
                    definitionVersionId: defVersion.id,
                    relationshipId
                },
                orderBy: { submissionNumber: 'desc' },
                select: { submissionNumber: true }
            });

            const nextSubmissionNumber = (lastSub?.submissionNumber || 0) + 1;

            const submission = await tx.questionnaireSubmission.create({
                data: {
                    questionnaireId,
                    definitionVersionId: defVersion.id,
                    relationshipId,
                    clientLEId,
                    submissionNumber: nextSubmissionNumber,
                    submittedById,
                    submittedAt: new Date()
                }
            });

            // Create SubmissionAnswers and Attachments
            for (const snap of defVersion.questionSnapshots) {
                const resolved = resolvedAnswerMap.get(snap.sourceQuestionId);

                const subAnswer = await tx.submissionAnswer.create({
                    data: {
                        submissionId: submission.id,
                        questionSnapshotId: snap.id,
                        sourceQuestionId: snap.sourceQuestionId,
                        masterFieldNo: snap.masterFieldNo,
                        masterQuestionGroupId: snap.masterQuestionGroupId,
                        questionTextSnapshot: snap.questionText,
                        valueJson: resolved?.valueJson !== undefined ? resolved.valueJson : null,
                        explicitNone: resolved?.explicitNone || false,
                        provenanceJson: resolved?.provenanceJson || null,
                    }
                });

                if (resolved?.documentIds && resolved.documentIds.length > 0) {
                    await tx.submissionAnswerAttachment.createMany({
                        data: resolved.documentIds.map(documentId => ({
                            submissionAnswerId: subAnswer.id,
                            documentId
                        }))
                    });
                }
            }

            return {
                submissionId: submission.id,
                versionNumber: defVersion.versionNumber,
                submissionNumber: nextSubmissionNumber
            };
        });

        return {
            success: true,
            submissionId: result.submissionId,
            versionNumber: result.versionNumber,
            submissionNumber: result.submissionNumber
        };

    } catch (e: any) {
        console.error("[createQuestionnaireSubmission] Failed:", e);
        return { success: false, error: e.message || "Failed to create questionnaire submission." };
    }
}

/**
 * Returns the latest QuestionnaireSubmission for a specific questionnaire and relationship.
 */
export async function getLatestSubmissionForRelationship(
    questionnaireId: string,
    relationshipId: string
) {
    return prisma.questionnaireSubmission.findFirst({
        where: { questionnaireId, relationshipId },
        orderBy: { submittedAt: 'desc' },
        include: {
            definitionVersion: true,
            submittedBy: { select: { id: true, name: true, email: true } },
            relationship: { include: { org: true } },
            answers: {
                include: {
                    questionSnapshot: true,
                    attachments: { include: { document: true } }
                }
            }
        }
    });
}

/**
 * Returns all submissions for a questionnaire, grouped/ordered by definition version and submission number.
 * If relationshipId is provided, filters strictly to that relationship.
 */
export async function getSubmissionHistoryForRelationship(
    questionnaireId: string,
    relationshipId?: string
) {
    return prisma.questionnaireSubmission.findMany({
        where: {
            questionnaireId,
            ...(relationshipId ? { relationshipId } : {})
        },
        orderBy: [
            { definitionVersion: { versionNumber: 'desc' } },
            { submissionNumber: 'desc' }
        ],
        include: {
            definitionVersion: true,
            submittedBy: { select: { id: true, name: true, email: true } },
            relationship: { include: { org: true } },
            answers: {
                select: {
                    id: true,
                    masterFieldNo: true,
                    valueJson: true,
                    explicitNone: true,
                    attachments: { select: { documentId: true } }
                }
            }
        }
    });
}

/**
 * Retrieves a complete submission by ID with frozen questions, answers, and attachments.
 */
export async function getSubmissionById(submissionId: string) {
    return prisma.questionnaireSubmission.findUnique({
        where: { id: submissionId },
        include: {
            questionnaire: { select: { id: true, name: true } },
            definitionVersion: true,
            submittedBy: { select: { id: true, name: true, email: true } },
            relationship: { include: { org: true, clientLE: true } },
            clientLE: { select: { id: true, name: true } },
            answers: {
                orderBy: { questionSnapshot: { order: 'asc' } },
                include: {
                    questionSnapshot: true,
                    attachments: { include: { document: true } }
                }
            }
        }
    });
}
