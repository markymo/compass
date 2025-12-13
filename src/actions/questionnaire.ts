"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createQuestionnaire(orgId: string, formData: FormData) {
    const name = formData.get("name") as string;
    const file = formData.get("file") as File;

    if (!name || !file) {
        return { success: false, error: "Name and File are required" };
    }

    try {
        // Convert File to Buffer/Bytes
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer as any);

        const questionnaire = await prisma.questionnaire.create({
            data: {
                fiOrgId: orgId,
                name: name,
                fileName: file.name,
                fileType: file.type,
                fileContent: buffer,
                status: "DRAFT",
            },
        });

        revalidatePath(`/app/admin/organizations/${orgId}`);
        return { success: true, data: questionnaire };
    } catch (error) {
        console.error("Failed to create questionnaire:", error);
        return { success: false, error: "Database Error" };
    }
}

export async function getQuestionnaires(orgId: string) {
    return await prisma.questionnaire.findMany({
        where: { fiOrgId: orgId },
        orderBy: { updatedAt: "desc" },
    });
}

export async function getQuestionnaireById(id: string) {
    return await prisma.questionnaire.findUnique({
        where: { id },
        include: { fiOrg: true }
    });
}

// AI Mapper Integration
import { processDocumentBuffer, generateMappingSuggestions, extractQuestionnaireItems } from "./ai-mapper";

export async function analyzeQuestionnaire(id: string) {
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q || !q.fileContent) throw new Error("Questionnaire not found or has no file");

    // 1. Process the buffer
    const processed = await processDocumentBuffer(Buffer.from(q.fileContent), q.fileType, q.fileName);

    // 2. Run AI
    const suggestions = await generateMappingSuggestions(processed);

    return {
        suggestions,
        fiOrgId: q.fiOrgId,
        questionnaireName: q.name
    };
}

export async function extractDetailedContent(id: string) {
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q || !q.fileContent) throw new Error("Questionnaire not found");

    try {
        const processed = await processDocumentBuffer(Buffer.from(q.fileContent), q.fileType, q.fileName);
        const extractedItems = await extractQuestionnaireItems(processed);

        await prisma.questionnaire.update({
            where: { id },
            data: { extractedContent: extractedItems as any }
        });

        revalidatePath(`/app/admin/questionnaires/${id}`);
        return { success: true, count: extractedItems.length };
    } catch (e) {
        console.error("Extraction Failed", e);
        return { success: false, error: "Extraction Failed" };
    }
}

// Renaming to generic save function or just updating this one
export async function saveQuestionnaireChanges(id: string, items: any[], mappings?: any) {
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) throw new Error("Questionnaire not found");

    const updateData: any = {
        extractedContent: items,
        status: "ACTIVE" // Mark as active if reviewed? Or keep as is?
    };

    if (mappings) {
        updateData.mappings = mappings;
    }

    await prisma.questionnaire.update({
        where: { id },
        data: updateData
    });

    revalidatePath(`/app/admin/questionnaires/${id}`);
    revalidatePath(`/app/admin/organizations/${q.fiOrgId}`);
    return { success: true };
}
