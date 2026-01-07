"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canManageQuestionnaire, isSystemAdmin } from "./security";

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

        if (buffer.length === 0) {
            return { success: false, error: "File is empty" };
        }

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
// AI Mapper Integration
import { processDocumentBuffer, extractQuestionnaireItems, generateMappingSuggestions } from "./ai-mapper";

export async function analyzeQuestionnaire(id: string) {
    if (!(await canManageQuestionnaire(id))) {
        throw new Error("Unauthorized");
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q || !q.fileContent) throw new Error("Questionnaire not found");

    try {
        const processed = await processDocumentBuffer(Buffer.from(q.fileContent), q.fileType, q.fileName);
        const suggestions = await generateMappingSuggestions(processed);

        return {
            suggestions,
            fiOrgId: q.fiOrgId,
            questionnaireName: q.name
        };
    } catch (e: any) {
        // If scanned PDF, we can't do much in this legacy function yet, just rethrow
        throw e;
    }
}



export async function extractDetailedContent(id: string, images?: string[]) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q || !q.fileContent) throw new Error("Questionnaire not found");

    try {
        let processed;

        if (images && images.length > 0) {
            // Client-side provided images (Scanned PDF fallback)
            processed = {
                content: images,
                type: "image" as "image", // explicit cast
                mime: "image/png"
            };
        } else {
            // Standard Server-side processing
            processed = await processDocumentBuffer(Buffer.from(q.fileContent), q.fileType, q.fileName);
        }

        const extractedItems = await extractQuestionnaireItems(processed);

        await prisma.questionnaire.update({
            where: { id },
            data: { extractedContent: extractedItems as any }
        });

        revalidatePath(`/app/admin/questionnaires/${id}`);
        return { success: true, count: extractedItems.length };
    } catch (e: any) {
        console.error("Extraction Failed", e);
        return { success: false, error: e.message || "Extraction Failed" };
    }
}

// Renaming to generic save function or just updating this one
export async function saveQuestionnaireChanges(id: string, items: any[], mappings?: any) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
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

    revalidatePath(`/app/admin/organizations/${q.fiOrgId}`);
    return { success: true };
}

export async function toggleQuestionnaireStatus(id: string, newStatus: "ACTIVE" | "ARCHIVED" | "DRAFT") {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) throw new Error("Questionnaire not found");

    await prisma.questionnaire.update({
        where: { id },
        data: { status: newStatus }
    });

    revalidatePath(`/app/admin/questionnaires/${id}`);
    revalidatePath(`/app/admin/organizations/${q.fiOrgId}`);
    return { success: true };
}

export async function deleteQuestionnaire(id: string) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) return { success: false, error: "Questionnaire not found" };

    if (q.status !== "DRAFT") {
        return { success: false, error: "Only DRAFT questionnaires can be deleted. Please Archive used questionnaires instead." };
    }

    try {
        await prisma.questionnaire.delete({ where: { id } });
        revalidatePath(`/app/admin/organizations/${q.fiOrgId}`);
        return { success: true };
    } catch (error) {
        console.error("Delete failed:", error);
        return { success: false, error: "Database error during deletion" };
    }
}
