"use server"

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { QuestionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { generateAIAnswers, learnFromAnswer } from "./ai-autofill";

/**
 * Parses the 'extractedContent' JSON of a Questionnaire and creates individual Question records.
 * This effectively "Instantiates" the questionnaire for the Kanban board.
 */
export async function populateQuestionsFromExtraction(questionnaireId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { extractedContent: true, id: true }
    });

    if (!questionnaire || !questionnaire.extractedContent) {
        return { success: false, error: "Questionnaire content not found" };
    }

    try {
        const content: any = questionnaire.extractedContent;
        // Assuming extractedContent structure has 'fields' or 'questions' array
        // Fallback to strict schema if needed, but flex handling for now
        const questionsToCreate: any[] = [];

        let orderCounter = 0;

        // Helper to extract questions recursively or from flat list
        const extract = (items: any[]) => {
            for (const item of items) {
                if (item.type === 'question' || item.question) {
                    questionsToCreate.push({
                        questionnaireId: questionnaire.id,
                        text: item.question || item.text || "Untitled Question",
                        order: orderCounter++,
                        status: 'DRAFT' as QuestionStatus,
                        sourceSectionId: item.section || null // simplified
                    });
                }
                // Handle nested sections if they exist in your extraction schema
                if (item.children) extract(item.children);
            }
        };

        // If extraction is just an array
        if (Array.isArray(content)) {
            extract(content);
        } else if (content.fields) {
            extract(content.fields);
        } else if (content.questions) {
            extract(content.questions);
        }

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
    const { userId } = await auth();
    if (!userId) return []; // Security: Add Org check later

    const questions = await prisma.question.findMany({
        where: {
            questionnaire: {
                engagements: {
                    some: {
                        id: engagementId
                    }
                }
            }
        },
        orderBy: { order: 'asc' },
        include: {
            comments: {
                include: { user: true },
                orderBy: { createdAt: 'asc' }
            },
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
        question: q.text,
        answer: q.answer || undefined,
        status: q.status,
        isLocked: (q as any).isLocked,
        assignee: q.assignedToUserId ? { name: 'User', type: 'USER' } : undefined, // Simplify for now
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
    const { userId } = await auth();
    if (!userId) return { success: false };

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
 * Instantiate a questionnaire for an engagement (Clone Template)
 */
export async function instantiateQuestionnaire(templateId: string, engagementId: string, name: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    try {
        // 1. Fetch Template (Mocking a 'template' fetch by just using mock content if not found)
        // In real app, we'd fetch prisma.questionnaire.findUnique({ where: { id: templateId } })

        const mockExtraction = {
            questions: [
                { question: "What is the full legal name of the entity?", section: "Identity" },
                { question: "Provide the primary business address.", section: "Identity" },
                { question: "List all beneficial owners >25%.", section: "Ownership" },
                { question: "Is the entity listed on a regulated exchange?", section: "Governance" },
                { question: "Provide date of incorporation.", section: "Identity" }
            ]
        };

        // 2. Create New Questionnaire Instance
        const engagement = await prisma.fIEngagement.findUnique({
            where: { id: engagementId }, include: { org: true }
        });

        if (!engagement) return { success: false, error: "Engagement not found" };

        const newQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: name,
                fiOrgId: engagement.fiOrgId,
                status: "ACTIVE",
                extractedContent: mockExtraction,
                engagements: {
                    connect: { id: engagementId }
                }
            }
        });

        // 3. Populate Questions
        await populateQuestionsFromExtraction(newQuestionnaire.id);

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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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

    // 1. Fetch Standing Data
    const standingDataSections = await prisma.standingDataSection.findMany({
        where: { clientLEId }
    });

    if (standingDataSections.length === 0) {
        const mockAnswer = "I cannot answer this yet because the Knowledge Base is empty. Please add content to the Knowledge Base for this entity first.";
        // Log "No Data" generic activity
        await prisma.questionActivity.create({
            data: {
                questionId,
                userId,
                type: "AI_GENERATED",
                details: { answerSnippet: "Failed: Knowledge Base Empty" }
            }
        });
        return { success: true, answer: mockAnswer };
    }

    // Format Context
    const contextText = standingDataSections.map(section =>
        `SECTION: ${section.category}\nCONTENT:\n${section.content}\n`
    ).join("\n---\n");

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
    const { userId } = await auth();
    // Fetch name for UI
    const user = await prisma.user.findUnique({ where: { id: userId! } });

    if (!userId || !user) return { success: false, error: "Unauthorized" };

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
                author: user.name || "User",
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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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
