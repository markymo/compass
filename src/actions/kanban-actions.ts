"use server"

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { QuestionStatus } from "@prisma/client";

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
            }
        }
    });

    // Map to frontend Task shape
    return questions.map(q => ({
        id: q.id,
        question: q.text,
        answer: q.answer || undefined,
        status: q.status,
        assignee: q.assignedToUserId ? { name: 'User', type: 'USER' } : undefined, // Simplify for now
        commentCount: q.comments.length,
        comments: q.comments.map(c => ({
            id: c.id,
            text: c.text,
            author: c.user?.name || "User",
            type: c.type || "USER",
            time: c.createdAt.toLocaleDateString() // Ideally relative time
        }))
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
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to save answer" };
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
        return { success: false, error: "Failed to add comment" };
    }
}
