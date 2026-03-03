"use server"

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { QuestionStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { generateAIAnswers, learnFromAnswer } from "./ai-autofill";
import { recordActivity, LEActivityType } from "@/lib/le-activity";

/**
 * Parses the 'extractedContent' JSON of a Questionnaire and creates individual Question records.
 * This effectively "Instantiates" the questionnaire for the Kanban board.
 */
export async function populateQuestionsFromExtraction(questionnaireId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { extractedContent: true, id: true, fiOrgId: true }
    });

    if (!questionnaire || !questionnaire.extractedContent) {
        return { success: false, error: "Questionnaire content not found" };
    }

    try {
        const content: any = questionnaire.extractedContent;
        const questionsToCreate: any[] = [];
        let orderCounter = 0;

        // 1. Collect all potential new fields
        const newFieldsToCreate: Map<string, { label: string, type: string }> = new Map();

        const collectFields = (items: any[]) => {
            for (const item of items) {
                if (item.newFieldProposal && !item.masterKey) {
                    const key = item.newFieldProposal.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    newFieldsToCreate.set(key, item.newFieldProposal);
                }
                if (item.children) collectFields(item.children);
            }
        };

        if (Array.isArray(content)) collectFields(content);
        else if (content.fields) collectFields(content.fields);
        else if (content.questions) collectFields(content.questions);

        // 2. Upsert CustomFieldDefinitions
        const customFieldIdMap = new Map<string, string>(); // key -> id

        if (newFieldsToCreate.size > 0) {
            for (const [key, proposal] of newFieldsToCreate) {
                // We upsert to ensure we don't duplicate if it already exists for this Org
                const cf = await prisma.customFieldDefinition.upsert({
                    where: {
                        orgId_key: {
                            orgId: questionnaire.fiOrgId,
                            key: key
                        }
                    },
                    update: {}, // No update if exists
                    create: {
                        orgId: questionnaire.fiOrgId,
                        key: key,
                        label: proposal.label,
                        dataType: proposal.type.toUpperCase(),
                        description: "Auto-created from AI extraction"
                    }
                });
                customFieldIdMap.set(key, cf.id);
            }
        }

        // 3. Create Questions with Links
        const extract = (items: any[]) => {
            for (const item of items) {
                const type = item.type?.toLowerCase();
                if (type === 'question' || item.question) {
                    let customFieldId = null;
                    if (item.newFieldProposal && !item.masterKey) {
                        const key = item.newFieldProposal.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
                        customFieldId = customFieldIdMap.get(key) || null;
                    }

                    questionsToCreate.push({
                        questionnaireId: questionnaire.id,
                        text: item.text || item.question || item.originalText || "Untitled Question",
                        compactText: item.compactText || null,
                        order: item.order ?? orderCounter++,
                        status: item.masterKey ? ('MAPPED_DRAFT' as QuestionStatus) : ('UNMAPPED' as QuestionStatus),
                        sourceSectionId: item.section || null,

                        // COORDINATOR WORKFLOW: Initially assign to the triggering LE Admin
                        assignedToUserId: userId,

                        // MAP AI FIELDS
                        masterFieldNo: item.masterKey ? parseInt(item.masterKey) : null,
                        masterQuestionGroupId: item.masterQuestionGroupId || null,
                        customFieldDefinitionId: customFieldId
                    });
                }
                if (item.children) extract(item.children);
            }
        };

        if (Array.isArray(content)) extract(content);
        else if (content.fields) extract(content.fields);
        else if (content.questions) extract(content.questions);

        if (questionsToCreate.length === 0) {
            return { success: false, error: "No questions found in extraction" };
        }

        // Batch create
        await prisma.question.createMany({
            data: questionsToCreate
        });

        return { success: true, count: questionsToCreate.length };

    } catch (e) {
        console.error("Failed to populate:", e);
        return { success: false, error: "Failed to process extraction data" };
    }
}

/**
 * Fetch all questions for a given Engagement (aggregating all linked questionnaires)
 */
export async function getBoardQuestions(engagementId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    // 0. Resolve Subject and Scope Context for Master Data
    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        include: { clientLE: true }
    });

    const subjectLeId = engagement?.clientLE?.legalEntityId;
    const clientLEId = engagement?.clientLEId;
    const ownerScopeId = clientLEId ? await KycStateService.resolveScopeId(clientLEId) : null;

    const questions = await prisma.question.findMany({
        where: {
            OR: [
                {
                    questionnaire: {
                        isDeleted: false,
                        engagements: {
                            some: { id: engagementId }
                        }
                    }
                },
                {
                    questionnaire: {
                        isDeleted: false,
                        fiEngagementId: engagementId
                    }
                }
            ]
        },
        orderBy: { order: 'asc' },
        include: {
            // @ts-ignore
            comments: {
                include: { user: true },
                orderBy: { createdAt: 'asc' }
            },
            // @ts-ignore
            assignedToUser: true,
            // @ts-ignore: Prisma client lag
            activities: {
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            },
            // @ts-ignore: schema additions
            documents: true
        }
    });

    // 1. Resolve Master Data for each question
    const resolvedQuestions = await Promise.all(questions.map(async q => {
        let finalAnswer = q.answer || undefined;
        const isReleased = q.status === 'RELEASED';
        const snapshotDate = isReleased ? (q as any).releasedAt : undefined;

        // If mapped to master data, try to resolve the authoritative value
        if (subjectLeId && q.masterFieldNo) {
            const derived = await KycStateService.getAuthoritativeValue(
                { subjectLeId },
                q.masterFieldNo,
                ownerScopeId || undefined,
                snapshotDate
            );

            if (derived) {
                if (typeof derived.value === 'object' && derived.value !== null) {
                    finalAnswer = JSON.stringify(derived.value);
                } else {
                    finalAnswer = String(derived.value ?? "");
                }
            }
        }

        return {
            id: q.id,
            questionnaireId: q.questionnaireId,
            question: q.text,
            compactText: (q as any).compactText || undefined,
            answer: finalAnswer,
            status: q.status,
            isLocked: (q as any).isLocked || isReleased,
            assignedToUserId: q.assignedToUserId,
            assignedEmail: (q as any).assignedEmail,
            assignee: q.assignedToUserId
                ? { name: (q as any).assignedToUser?.name || (q as any).assignedToUser?.email || 'User', type: 'USER' }
                : ((q as any).assignedEmail ? { name: (q as any).assignedEmail, type: 'INVITEE' } : undefined),
            commentCount: (q as any).comments?.length || 0,
            comments: ((q as any).comments || []).map((c: any) => ({
                id: c.id,
                text: c.text,
                author: c.user?.name || "User",
                type: c.type || "USER",
                time: c.createdAt.toLocaleDateString()
            })),
            // @ts-ignore: Prisma client lag
            activities: q.activities ? q.activities.map((a: any) => ({
                id: a.id,
                type: a.type,
                details: a.details,
                userName: a.user.name || "User",
                createdAt: a.createdAt
            })) : [],
            // @ts-ignore
            allowAttachments: q.allowAttachments,
            // @ts-ignore
            documents: q.documents ? q.documents.map((d: any) => ({
                id: d.id,
                name: d.name,
                fileType: d.fileType,
                fileUrl: d.fileUrl,
                kbSize: d.kbSize
            })) : [],
            masterFieldNo: q.masterFieldNo,
            approvedAt: (q as any).approvedAt,
            releasedAt: (q as any).releasedAt,
            sharedAt: (q as any).sharedAt
        };
    }));

    return resolvedQuestions;
}

/**
 * Update a question's status (Drag and Drop persistence)
 */
export async function updateQuestionStatus(questionId: string, newStatus: QuestionStatus) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false };
    const { userId } = identity;

    try {
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            select: { status: true }
        });

        if (question?.status === 'RELEASED' || newStatus === 'RELEASED') {
            return { success: false, error: "Released questions cannot be moved via Drag-and-Drop. Use the Detail Panel." };
        }

        await prisma.question.update({
            where: { id: questionId },
            data: { status: newStatus }
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: "Update failed" };
    }
}

/**
 * Approve Question Mapping
 */
export async function approveQuestionMapping(questionId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            select: { masterFieldNo: true, status: true }
        });

        if (!question?.masterFieldNo) {
            return { success: false, error: "Cannot approve unmapped question" };
        }
        if (question.status !== 'DRAFT') {
            return { success: false, error: "Only draft mappings can be approved" };
        }

        await prisma.question.update({
            where: { id: questionId },
            data: {
                status: 'APPROVED',
                approvedAt: new Date(),
                approvedByUserId: userId,
                approvedMappingConfig: { fieldNo: question.masterFieldNo }
            }
        });

        await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "MAPPING_APPROVED",
                details: { fieldNo: question.masterFieldNo }
            }
        });

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Approval failed" };
    }
}

/**
 * Share Question (Toggle)
 */
export async function shareQuestion(questionId: string, isShared: boolean) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            select: { status: true }
        });

        if (isShared) {
            if (question.status !== 'APPROVED' && question.status !== 'SHARED') {
                return { success: false, error: "Question must be approved before sharing" };
            }
        }

        const newStatus = isShared ? 'SHARED' : 'APPROVED';

        await prisma.question.update({
            where: { id: questionId },
            data: {
                status: newStatus,
                sharedAt: isShared ? new Date() : null,
                sharedByUserId: isShared ? userId : null
            }
        });

        await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: isShared ? "QUESTION_SHARED" : "QUESTION_UNSHARED",
                details: {}
            }
        });

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Sharing failed" };
    }
}

/**
 * Release Question (Lockdown)
 */
export async function releaseQuestion(questionId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    // TODO: Verify LE_ADMIN role

    try {
        await prisma.question.update({
            where: { id: questionId },
            data: {
                status: 'RELEASED',
                releasedAt: new Date(),
                releasedByUserId: userId,
                isLocked: true
            }
        });

        await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "QUESTION_RELEASED",
                details: {}
            }
        });

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Release failed" };
    }
}

/**
 * Update Question Mapping with Safety Reset
 */
export async function updateQuestionMapping(questionId: string, fieldNo: number | null) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            select: { status: true }
        });

        if (question?.status === 'RELEASED') {
            return { success: false, error: "Cannot change mapping of a released question" };
        }

        await prisma.question.update({
            where: { id: questionId },
            data: {
                masterFieldNo: fieldNo,
                masterQuestionGroupId: null,
                customFieldDefinitionId: null,
                status: fieldNo ? 'DRAFT' : 'DRAFT', // The Safety Reset
                approvedAt: null,
                approvedByUserId: null,
                sharedAt: null,
                sharedByUserId: null,
                approvedMappingConfig: Prisma.JsonNull
            }
        });

        await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "MAPPING_UPDATED",
                details: { fieldNo }
            }
        });

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Mapping update failed" };
    }
}

/**
 * Instantiate a questionnaire for an engagement (Clone Template from DB)
 */
export async function instantiateQuestionnaire(templateId: string, engagementId: string, name: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        // 1. Fetch Template from DB
        const template = await prisma.questionnaire.findUnique({
            where: { id: templateId }
        });

        if (!template) {
            return { success: false, error: "Template questionnaire not found" };
        }

        // 2. Create New Questionnaire Instance
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            include: { org: true }
        });

        if (!engagement) return { success: false, error: "Engagement not found" };

        const newQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: name || template.name,
                fiOrgId: engagement.fiOrgId,
                status: "ACTIVE",
                extractedContent: template.extractedContent as any,
                fiEngagementId: engagementId, // Set for direct relation
                engagements: {
                    connect: { id: engagementId }
                }
            }
        });

        // 3. Populate Questions from the template's extractedContent
        await populateQuestionsFromExtraction(newQuestionnaire.id);

        revalidatePath(`/app/le/${engagement.clientLEId}/engagement-new/${engagementId}`);
        return { success: true, id: newQuestionnaire.id };
    } catch (e) {
        console.error("Instantiation failed", e);
        return { success: false, error: "Failed to instantiate" };
    }
}

/**
 * Update a question's answer
 */
export async function updateAnswer(questionId: string, answer: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const question = await prisma.question.update({
            where: { id: questionId },
            data: { answer: answer },
            include: {
                questionnaire: {
                    include: {
                        engagements: true,
                        fiEngagement: true
                    }
                }
            }
        });

        const engagement = question?.questionnaire.fiEngagement || question?.questionnaire.engagements[0];
        const clientLEId = engagement?.clientLEId;

        // SYNC TO MASTER DATA (FieldClaims) if mapped
        if (clientLEId && question.masterFieldNo) {
            const { applyManualOverride } = await import("./kyc-manual-update");
            await applyManualOverride(
                clientLEId,
                question.masterFieldNo,
                answer,
                `Updated via Questionnaire Workbench`
            );
        }

        // Log Activity
        // @ts-ignore: Prisma client lag
        const activity = await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "ANSWER_UPDATED",
                details: {}
            },
            include: { user: true }
        });

        // Fire LEActivity (LE-level timeline)
        if (clientLEId) {
            const wasFirstAnswer = !question?.answer; // answered fresh
            recordActivity(clientLEId, userId,
                wasFirstAnswer ? LEActivityType.QUESTION_ANSWERED : LEActivityType.QUESTION_UPDATED,
                { questionId, questionText: question?.text?.slice(0, 80) }
            ); // fire-and-forget
        }

        // TRIGGER LEARNING LOOP (Fire and forget, or await?)
        // Let's await to ensure it runs, but wrap in try-catch so it doesn't block success
        if (clientLEId && answer && answer.length > 5 && question) {
            // Running in background (no await) would be better for UX speed, 
            // but Vercel serverless functions might kill it. 
            // We'll await it for safety in this prototype.
            // Running fire-and-forget to prevent UI blocking
            learnFromAnswer(clientLEId, question.text, answer, userId).catch(err => {
                console.error("Learning Loop background error:", err);
            });
        }

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");

        return {
            success: true,
            activity: {
                id: activity.id,
                type: activity.type,
                details: activity.details,
                userName: activity.user.name || "User",
                createdAt: activity.createdAt
            }
        };
    } catch (e) {
        console.error("Update Answer Error:", e);
        return { success: false, error: "Failed to save answer" };
    }
}

/**
 * Attach an uploaded file to a Question as a Document record.
 * Can be called either from onUploadCompleted (Vercel Blob) or directly from
 * the client after a successful blob upload (more reliable in local dev).
 */
export async function attachDocumentToQuestion(questionId: string, fileUrl: string, fileName: string, fileSize?: number) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        // Fetch question with BOTH engagement relations:
        // 1. Many-to-many (engagements) — used for templates
        // 2. Direct (fiEngagement via fiEngagementId) — used for instantiated questionnaires
        const questionData = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                questionnaire: {
                    include: {
                        engagements: true,      // many-to-many relation
                        fiEngagement: true,      // direct QuestionnaireInstance relation
                    }
                }
            }
        });

        if (!questionData) return { success: false, error: "Question not found" };

        // Try both relations to find the linked engagement
        const engagementFromM2M = (questionData.questionnaire as any).engagements?.[0];
        const engagementFromDirect = (questionData.questionnaire as any).fiEngagement;
        const clientLEId =
            engagementFromM2M?.clientLEId ??
            engagementFromDirect?.clientLEId ??
            null;

        if (!clientLEId) {
            console.error("attachDocumentToQuestion: could not resolve clientLEId for question", questionId,
                { m2m: engagementFromM2M, direct: engagementFromDirect });
            return { success: false, error: "Client LE context missing for document" };
        }

        // Create the Document and link it to the Question
        const document = await prisma.document.create({
            data: {
                name: fileName,
                fileUrl: fileUrl,
                fileType: fileName.split('.').pop() || 'unknown',
                kbSize: fileSize ? Math.round(fileSize / 1024) : null,
                clientLEId: clientLEId,
                questionId: questionId,
            }
        });

        // Log Activity
        await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "DOC_UPLOADED",
                details: { documentId: document.id, documentName: document.name }
            }
        });

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");

        return { success: true, document };
    } catch (e) {
        console.error("Attach Document Error:", e);
        return { success: false, error: "Failed to attach document" };
    }
}


/**
 * Toggle lock status
 */
export async function toggleQuestionLock(questionId: string, isLocked: boolean) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        // Explicitly typing the update payload to bypass transient TS errors
        const dataPayload: any = { isLocked };
        await prisma.question.update({
            where: { id: questionId },
            data: dataPayload
        });

        // Log Activity
        // @ts-ignore: Prisma client lag
        const activity = await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: isLocked ? "LOCKED" : "UNLOCKED",
                details: {}
            },
            include: { user: true }
        });

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");

        return {
            success: true,
            activity: {
                id: activity.id,
                type: activity.type,
                details: activity.details,
                userName: activity.user.name || "User",
                createdAt: activity.createdAt
            }
        };
    } catch (e) {
        console.error("Toggle Lock Error:", e);
        return { success: false, error: "Failed to toggle lock" };
    }
}

/**
 * Generate a single question answer (Mock AI)
 */
export async function generateSingleQuestionAnswer(questionId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    // In future: Fetch question -> Vector DB Lookup -> LLM Synthesis
    // For now: Return a "smart" mock answer
    await new Promise(r => setTimeout(r, 1500)); // Fake latency

    // Fetch question with traversal to ClientLE
    const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: {
            questionnaire: {
                include: {
                    engagements: {
                        include: {
                            clientLE: true
                        },
                        take: 1 // Assume context comes from the first linked engagement for now
                    }
                }
            }
        }
    });

    if (!question) return { success: false, error: "Question not found" };

    // Extract Context
    const engagement = question.questionnaire.engagements[0];
    const clientLEId = engagement?.clientLEId;

    if (!clientLEId) {
        return { success: false, error: "No Client LE context found" };
    }

    // 1. Fetch Standing Data & Registry Data
    const [standingDataSections, le] = await Promise.all([
        prisma.standingDataSection.findMany({
            where: { clientLEId }
        }),
        prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { lei: true, gleifData: true }
        })
    ]);

    if (standingDataSections.length === 0 && !le?.gleifData) {
        const mockAnswer = "I cannot answer this yet because the Knowledge Base is empty and no Official Registry data (GLEIF) is available. Please add content to the Knowledge Base first.";
        // Log "No Data" generic activity
        await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "AI_GENERATED",
                details: { answerSnippet: "Failed: Context Empty" }
            }
        });
        return { success: true, answer: mockAnswer };
    }

    // Format Context
    let contextText = standingDataSections.map(section =>
        `SECTION: ${section.category}\nCONTENT:\n${section.content}\n`
    ).join("\n---\n");

    if (le?.gleifData) {
        const gd: any = le.gleifData;
        const attributes = gd.attributes || {};
        const entity = attributes.entity || {};
        const reg = attributes.registration || {};

        const registryContext = `
--- OFFICIAL REGISTRY DATA (GLEIF) ---
LEI: ${le.lei}
Legal Name: ${entity.legalName?.name}
Jurisdiction: ${entity.jurisdiction}
Entity Status: ${entity.status}
Legal Address: ${entity.legalAddress?.addressLines?.join(", ")}, ${entity.legalAddress?.city}, ${entity.legalAddress?.country}
HQ Address: ${entity.headquartersAddress?.addressLines?.join(", ")}, ${entity.headquartersAddress?.city}, ${entity.headquartersAddress?.country}
Registration Status: ${reg.status}
Initial Registration: ${reg.initialRegistrationDate}
Next Renewal: ${reg.nextRenewalDate}
---------------------------------------
`;
        contextText = registryContext + "\n" + contextText;
    }

    try {
        // 2. Call Shared AI Service
        // Import must be added at top of file

        const aiResult = await generateAIAnswers(contextText, [{
            id: question.id,
            text: question.text,
            category: "General"
        }]);

        if (!aiResult.success || !aiResult.answers || aiResult.answers.length === 0) {
            throw new Error(aiResult.error || "No answer returned");
        }

        const answerData = aiResult.answers[0];
        const finalAnswer = answerData.answer;

        // 3. Log Activity with Rich Metadata
        // @ts-ignore: Prisma client lag
        const activity = await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "AI_GENERATED",
                details: {
                    answerSnippet: finalAnswer.slice(0, 50) + "...",
                    confidence: answerData.confidence,
                    sourceQuote: answerData.sourceQuote,
                    reasoning: answerData.reasoning
                }
            },
            include: { user: true }
        });

        return {
            success: true,
            answer: finalAnswer,
            activity: {
                id: activity.id,
                type: activity.type,
                details: activity.details,
                userName: activity.user.name || "User",
                createdAt: activity.createdAt
            }
        };

    } catch (e: any) {
        console.error("AI Generation Error:", e);
        return { success: false, error: e.message || "Failed to generate answer" };
    }
}

/**
 * Add a comment to a question
 */
export async function addComment(questionId: string, text: string) {
    const identity = await getIdentity();
    // Fetch name for UI
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    try {
        const comment = await prisma.comment.create({
            data: {
                questionId,
                userId,
                text,
                type: "USER"
            }
        });

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");

        return {
            success: true, comment: {
                id: comment.id,
                text: comment.text,
                author: user?.name || "User",
                type: "USER",
                time: "Just now" // Simplified for optimistic update
            }
        };
    } catch (e) {
        console.error("Add Comment Error:", e);
        return { success: false, error: "Failed to add comment" };
    }
}

/**
 * Batch generate answers for an entire engagement
 */
export async function generateEngagementAnswers(engagementId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        // 1. Fetch Engagement + Questions + ClientLE
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId },
            include: {
                questionnaires: {
                    include: {
                        questions: true
                    }
                }
            }
        });

        if (!engagement) return { success: false, error: "Engagement not found" };

        const clientLEId = engagement.clientLEId;
        if (!clientLEId) return { success: false, error: "No Client LE linked" };

        // 2. Fetch Knowledge Base (Standing Data)
        const standingDataSections = await prisma.standingDataSection.findMany({
            where: { clientLEId }
        });

        if (standingDataSections.length === 0) {
            return { success: false, error: "Knowledge Base is empty. Please add content first." };
        }

        const contextText = standingDataSections.map(section =>
            `SECTION: ${section.category}\nCONTENT:\n${section.content}\n`
        ).join("\n---\n");

        // 3. Collect all UNLOCKED questions
        let allQuestions: any[] = [];
        engagement.questionnaires.forEach(q => {
            q.questions.forEach(question => {
                // @ts-ignore: Prisma client lag
                if (!question.isLocked) {
                    allQuestions.push({
                        id: question.id,
                        text: question.text,
                        category: "General"
                    });
                }
            });
        });

        if (allQuestions.length === 0) {
            return { success: false, error: "No unlocked questions found to answer." };
        }

        // 4. Call AI Service
        const aiResult = await generateAIAnswers(contextText, allQuestions);

        if (!aiResult.success || !aiResult.answers) {
            throw new Error(aiResult.error || "AI generation failed");
        }

        // 5. Batch Update
        const updatePromises = aiResult.answers.map(async (ans) => {
            const questionId = ans.questionId;

            // Update Question
            const qUpdate = prisma.question.update({
                where: { id: questionId },
                data: { answer: ans.answer },
                include: {
                    questionnaire: {
                        include: {
                            engagements: true,
                            fiEngagement: true
                        }
                    }
                }
            });

            // Sync to Master Data if mapped
            const syncToMaster = async (questionData: any) => {
                const engagement = questionData?.questionnaire.fiEngagement || questionData?.questionnaire.engagements[0];
                const cLEId = engagement?.clientLEId;
                if (cLEId && questionData.masterFieldNo) {
                    const { applyManualOverride } = await import("./kyc-manual-update");
                    await applyManualOverride(
                        cLEId,
                        questionData.masterFieldNo,
                        ans.answer,
                        `AI Generated answer`
                    );
                }
            };

            // Create Activity
            // @ts-ignore: Prisma client lag
            const actCreate = prisma.questionActivity.create({
                data: {
                    questionId,
                    userId,
                    type: "AI_GENERATED",
                    details: {
                        answerSnippet: ans.answer.slice(0, 50) + "...",
                        confidence: ans.confidence,
                        sourceQuote: ans.sourceQuote,
                        reasoning: ans.reasoning
                    }
                }
            });

            const [updatedQ] = await prisma.$transaction([qUpdate, actCreate]);
            await syncToMaster(updatedQ);
            return updatedQ;
        });

        await Promise.all(updatePromises);

        revalidatePath("/(platform)/app/le/[id]/engagement-new/[engagementId]", "page");

        return { success: true, count: updatePromises.length };

    } catch (e: any) {
        console.error("Batch Generation Error:", e);
        return { success: false, error: e.message || "Failed to batch generate answers" };
    }
}

/**
 * Fetch all team members (Active & Pending) for a Client LE
 */
export async function getLETeamMembers(clientLEId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        // 1. Fetch Active Memberships
        const memberships = await prisma.membership.findMany({
            where: { clientLEId },
            include: { user: true }
        });

        // 2. Fetch Pending Invitations (Temporarily Disabled due to Schema Change)
        // const invitations = await prisma.invitation.findMany({
        //     where: { clientLEId, status: "PENDING" }
        // });
        const invitations: any[] = [];

        const members = memberships.map(m => ({
            id: m.userId,
            email: m.user.email,
            name: m.user.name || m.user.email,
            status: "ACTIVE" as const,
            role: m.role
        }));

        const invitees = invitations.map(i => ({
            id: undefined,
            email: i.email,
            name: i.email,
            status: "PENDING" as const,
            role: i.role
        }));

        // Deduplicate by email just in case (e.g. invited user also has org membership but LE membership is missing?)
        // Actually, if they are in memberships, they aren't PENDING anymore in this LE.
        return { success: true, team: [...members, ...invitees] };
    } catch (e) {
        console.error("Failed to fetch team members:", e);
        return { success: false, error: "Failed to fetch team" };
    }
}

/**
 * Assign a question to a user or invitee
 */
export async function assignQuestion(questionId: string, assignee: { userId?: string, email?: string } | null) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId: actorId } = identity;

    try {
        const question = await prisma.question.update({
            where: { id: questionId },
            data: {
                assignedToUserId: assignee?.userId || null,
                assignedByUserId: actorId, // Audit: who made the assignment
                assignedEmail: assignee?.email || null
            }
        });

        // Log Activity
        const activity = await prisma.questionActivity.create({
            data: {
                questionId,
                userId: actorId,
                type: "ASSIGNED",
                // @ts-ignore
                details: {
                    assignedToUserId: assignee?.userId || null,
                    assignedByUserId: actorId,
                    assignedEmail: assignee?.email || null
                }
            },
            include: { user: true }
        });

        return {
            success: true,
            activity: {
                id: activity.id,
                type: activity.type,
                details: activity.details,
                userName: activity.user.name || "User",
                createdAt: activity.createdAt
            }
        };
    } catch (e) {
        console.error("Failed to assign question:", e);
        return { success: false, error: "Assignment failed" };
    }
}

/**
 * Fetch all documents attached to questions within an engagement,
 * grouped with their question+answer context for the Documents tab.
 */
export async function getEngagementEvidenceDocuments(engagementId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized", documents: [] };

    try {
        // Gather all questions in this engagement that have at least one document attached
        const questions = await prisma.question.findMany({
            where: {
                OR: [
                    {
                        questionnaire: {
                            isDeleted: false,
                            engagements: { some: { id: engagementId } }
                        }
                    },
                    {
                        questionnaire: {
                            isDeleted: false,
                            fiEngagementId: engagementId
                        }
                    }
                ],
                documents: { some: { isDeleted: false } }
            },
            select: {
                id: true,
                text: true,
                compactText: true,
                answer: true,
                status: true,
                documents: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        name: true,
                        fileUrl: true,
                        fileType: true,
                        kbSize: true,
                        createdAt: true,
                    }
                }
            }
        });

        return { success: true, documents: questions };
    } catch (e) {
        console.error("Evidence documents fetch error:", e);
        return { success: false, error: "Failed to fetch evidence documents", documents: [] };
    }
}
