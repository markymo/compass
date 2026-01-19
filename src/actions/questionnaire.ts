"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canManageQuestionnaire, isSystemAdmin } from "./security";

import { logActivity } from "./logging";

export async function createQuestionnaire(orgId: string, formData: FormData) {
    const name = formData.get("name") as string;
    const file = formData.get("file") as File;

    if (!name) {
        return { success: false, error: "Name is required" };
    }

    try {
        let fileData: any = {};

        if (file && file.size > 0 && file.name !== "undefined") {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer as any);
            fileData = {
                fileName: file.name,
                fileType: file.type,
                fileContent: buffer,
            };
        } else {
            // Create empty placeholder if no file
            fileData = {
                fileName: null,
                fileType: null,
                fileContent: null
            }
        }

        const questionnaire = await prisma.questionnaire.create({
            data: {
                fiOrgId: orgId,
                name: name,
                status: "DRAFT",
                ...fileData
            },
        });

        await logActivity("CREATE_QUESTIONNAIRE", `/app/admin/organizations/${orgId}`, {
            questionnaireId: questionnaire.id,
            name: questionnaire.name,
            fiOrgId: orgId
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
        where: {
            fiOrgId: orgId,
            isDeleted: false,
            // We might want to show archived in a separate view, but hide from main list
            status: { not: "ARCHIVED" }
        },
        orderBy: { updatedAt: "desc" },
    });
}

// ... existing code ...

export async function deleteQuestionnaire(id: string) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) return { success: false, error: "Questionnaire not found" };

    try {
        // Soft Delete
        await prisma.questionnaire.update({
            where: { id },
            data: { isDeleted: true }
        });

        await logActivity("DELETE_QUESTIONNAIRE", `/app/admin/organizations/${q.fiOrgId}`, {
            questionnaireId: id,
            name: q.name,
            type: "SOFT_DELETE"
        });

        revalidatePath(`/app/admin/organizations/${q.fiOrgId}`);
        return { success: true };
    } catch (error) {
        console.error("Delete failed:", error);
        return { success: false, error: "Database error during deletion" };
    }
}

export async function archiveQuestionnaire(id: string) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) return { success: false, error: "Questionnaire not found" };

    try {
        await prisma.questionnaire.update({
            where: { id },
            data: { status: "ARCHIVED" }
        });

        await logActivity("ARCHIVE_QUESTIONNAIRE", `/app/admin/organizations/${q.fiOrgId}`, {
            questionnaireId: id,
            name: q.name
        });

        revalidatePath(`/app/admin/organizations/${q.fiOrgId}`);
        return { success: true };
    } catch (error) {
        console.error("Archive failed:", error);
        return { success: false, error: "Database error during archive" };
    }
}

export async function getQuestionnaireById(id: string) {
    if (!(await canManageQuestionnaire(id))) {
        return null;
    }
    return await prisma.questionnaire.findUnique({
        where: { id },
        include: {
            fiOrg: true,
            questions: {
                orderBy: { order: 'asc' }
            }
        }
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
        const processed = await processDocumentBuffer(Buffer.from(q.fileContent), q.fileType!, q.fileName!);
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



// 1. Step A: Extract Raw Text from Document (or Images)
export async function extractRawText(id: string, images?: string[]) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) throw new Error("Questionnaire not found");

    if (!q.fileContent) {
        if (!images || images.length === 0) {
            return { success: false, error: "NO_FILE", status: "NO_FILE" };
        }
    }

    try {
        let textContent = "";

        if (images && images.length > 0) {
            // Client-side provided images (Scanned PDF fallback)
            // We need a helper to iterate vision over images and concat text? 
            // Actually ai-mapper.parseDocument handles single buffer. 
            // We need a new exposed function in ai-mapper or just call processDocumentBuffer logic?
            // Let's rely on extraction causing a 'parse' effect?
            // Actually, we want to STOP after getting text.

            // For now, let's treat 'images' passing as a direct bypass to 'extractedContent' 
            // via the old flow, OR we impl a "Text From Images" helper.
            // Let's assume for this step we want to just get the text. 
            // Ideally we'd ask AI "Transcribe this".

            // To keep it simple for this migration: 
            // User uploads images -> We run "Extract Structure" directly (Legacy style) 
            // AND we save the "Original Text" from the result as 'rawText'.

            // BETTER PLAN: Update ai-mapper to have 'transcribeImages'.
            // For now, let's stick to the high-level flow. 

            // Re-use current pipeline for now to get JSON, then save JSON.
            // But we want 'rawText'. 
            // Let's defer 'rawText' for scanned PDFs to the AI Parsing phase?
            // No, user wants to see 'rawText' to edit it.

            // WORKAROUND: For scanned PDFs, 'rawText' might be empty initially, 
            // or we ask GPT-4o to "Just transcribe" first.
            // Let's allow 'rawText' to be updated by the AI Parse step if it was empty.

            return { success: true, status: "SKIPPED_TEXT_EXTRACT" }; // Placeholder
        }

        // Standard File Processing
        if (q.fileContent && q.fileType && q.fileName) {
            const processed = await processDocumentBuffer(Buffer.from(q.fileContent), q.fileType, q.fileName);

            if (processed.type === 'text') {
                textContent = processed.content as string;
            }
        }

        await prisma.questionnaire.update({
            where: { id },
            data: {
                rawText: textContent, // Type refreshed
                // Update status if we had one
            } as any
        });

        await logActivity("EXTRACT_TEXT", `/app/admin/questionnaires/${id}`, {
            questionnaireId: id,
            success: true,
            length: textContent.length
        });

        return { success: true, data: textContent };
    } catch (e: any) {
        await logActivity("EXTRACT_TEXT_ERROR", `/app/admin/questionnaires/${id}`, { error: e.message });
        if (e.message === "SCANNED_PDF_DETECTED") {
            return { success: false, error: "SCANNED_PDF_DETECTED" };
        }
        return { success: false, error: e.message };
    }
}

// 2. Step B: Parse Structure from Raw Text
export async function parseRawText(id: string, textOverride?: string) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }

    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) throw new Error("Questionnaire not found");

    const textToProcess = textOverride || (q as any).rawText;
    if (!textToProcess) throw new Error("No text to parse");

    try {
        // We reuse the existing AI Mapper but pass explicit text
        const processed = {
            content: textToProcess,
            type: "text" as "text",
            mime: "text/plain"
        };

        const extractedItems = await extractQuestionnaireItems(processed);

        await prisma.questionnaire.update({
            where: { id },
            data: {
                extractedContent: extractedItems as any,
                rawText: textToProcess // Save override if provided
            } as any
        });

        revalidatePath(`/app/admin/questionnaires/${id}`);

        await logActivity("PARSE_STRUCTURE", `/app/admin/questionnaires/${id}`, {
            questionnaireId: id,
            itemCount: extractedItems.length
        });

        return { success: true, count: extractedItems.length };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}


// LEGACY WRAPPER
export async function extractDetailedContent(id: string, images?: string[]): Promise<{ success: boolean; count?: number; error?: string; status?: string }> {
    // If images, we use old flow for now as "Text Extraction" from images is expensive/complex to separate
    if (images && images.length > 0) {
        // ... (Old logic for images)
        if (!(await canManageQuestionnaire(id))) return { success: false, error: "Unauthorized" };
        try {
            const processed = {
                content: images,
                type: "image" as "image",
                mime: "image/png"
            };
            const extractedItems = await extractQuestionnaireItems(processed);
            // Clean items to ensure no undefined values for Prisma JSON
            const cleanItems = JSON.parse(JSON.stringify(extractedItems));
            await prisma.questionnaire.update({ where: { id }, data: { extractedContent: cleanItems } });
            revalidatePath(`/app/admin/questionnaires/${id}`);
            return { success: true, count: extractedItems.length };
        } catch (e: any) { return { success: false, error: e.message }; }
    }

    // For text docs, we chain the new steps
    const extRes = await extractRawText(id);
    if (!extRes.success) return { success: false, error: extRes.error };

    // If we skipped extraction (e.g. somehow), we proceed to parse? 
    // extractRawText might return success but no data if it was images... 
    // Actually, extractRawText handled images by returning success:true, status: SKIPPED... 
    // But here we filtered images out in the first block. 
    // So distinct paths.

    return await parseRawText(id);
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

    await logActivity("SAVE_MAPPING", `/app/admin/questionnaires/${id}`, {
        questionnaireId: id,
        itemCount: items.length
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

export async function updateQuestionnaireName(id: string, newName: string) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }
    const q = await prisma.questionnaire.findUnique({ where: { id } });
    if (!q) throw new Error("Questionnaire not found");

    if (!newName || newName.trim() === "") return { success: false, error: "Name cannot be empty" };

    await prisma.questionnaire.update({
        where: { id },
        data: { name: newName }
    });

    revalidatePath(`/app/admin/questionnaires/${id}`);
    revalidatePath(`/app/admin/organizations/${q.fiOrgId}`);
    return { success: true };
}

export async function updateQuestionnaireFile(id: string, formData: FormData) {
    if (!(await canManageQuestionnaire(id))) {
        return { success: false, error: "Unauthorized" };
    }

    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
        return { success: false, error: "Invalid file" };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer as any);

        await prisma.questionnaire.update({
            where: { id },
            data: {
                fileName: file.name,
                fileType: file.type,
                fileContent: buffer,
            }
        });

        revalidatePath(`/app/admin/questionnaires/${id}`);
        return { success: true };
    } catch (e: any) {
        console.error("Update file failed:", e);
        return { success: false, error: e.message };
    }
}

// End of file
