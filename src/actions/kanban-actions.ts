"use server"

import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { QuestionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { generateAIAnswers, learnFromAnswer } from "./ai-autofill";

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
                        status: 'DRAFT' as QuestionStatus,
                        sourceSectionId: item.section || null,

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
    if (!identity?.userId) return []; // Security: Add Org check later
    const { userId } = identity;

    const questions = await prisma.question.findMany({
        where: {
            OR: [
                {
                    questionnaire: {
                        engagements: {
                            some: { id: engagementId }
                        }
                    }
                },
                {
                    questionnaire: {
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
            }
        }
    });

    // Map to frontend Task shape
    return questions.map(q => ({
        id: q.id,
        questionnaireId: q.questionnaireId,
        question: q.text,
        compactText: (q as any).compactText || undefined,
        answer: q.answer || undefined,
        status: q.status,
        isLocked: (q as any).isLocked,
        assignedToUserId: q.assignedToUserId,
        assignedEmail: (q as any).assignedEmail,
        assignee: q.assignedToUserId
            ? { name: q.assignedToUser?.name || q.assignedToUser?.email || 'User', type: 'USER' }
            : ((q as any).assignedEmail ? { name: (q as any).assignedEmail, type: 'INVITEE' } : undefined),
        commentCount: q.comments.length,
        comments: q.comments.map(c => ({
            id: c.id,
            text: c.text,
            author: c.user?.name || "User",
            type: c.type || "USER",
            time: c.createdAt.toLocaleDateString() // Ideally relative time
        })),
        // @ts-ignore: Prisma client lag
        activities: q.activities ? q.activities.map((a: any) => ({
            id: a.id,
            type: a.type,
            details: a.details,
            userName: a.user.name || "User",
            createdAt: a.createdAt
        })) : []
    }));
}

/**
 * Update a question's status (Drag and Drop persistence)
 */
export async function updateQuestionStatus(questionId: string, newStatus: QuestionStatus) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false };
    const { userId } = identity;

    try {
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
        await prisma.question.update({
            where: { id: questionId },
            data: { answer: answer }
        });

        // Fetch full question data to get context for AI Learning
        // We need the ClientLE ID
        const questionData = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                questionnaire: {
                    include: {
                        engagements: true
                    }
                }
            }
        });

        const engagement = questionData?.questionnaire.engagements[0];
        const clientLEId = engagement?.clientLEId;

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

        // TRIGGER LEARNING LOOP (Fire and forget, or await?)
        // Let's await to ensure it runs, but wrap in try-catch so it doesn't block success
        if (clientLEId && answer && answer.length > 5 && questionData) {
            // Running in background (no await) would be better for UX speed, 
            // but Vercel serverless functions might kill it. 
            // We'll await it for safety in this prototype.
            // Running fire-and-forget to prevent UI blocking
            learnFromAnswer(clientLEId, questionData.text, answer, userId).catch(err => {
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
                data: { answer: ans.answer }
            });

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

            return prisma.$transaction([qUpdate, actCreate]);
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
                assignedEmail: assignee?.email || null
            }
        });

        // Log Activity
        const activity = await prisma.questionActivity.create({
            data: {
                questionId,
                userId: actorId,
                type: "ASSIGNED",
                details: {
                    assignedToUserId: null,
                    // @ts-ignore
                    assignedEmail: nullassignee?.email
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
