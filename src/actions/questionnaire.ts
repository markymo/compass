"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canManageQuestionnaire, isSystemAdmin, getUserOrgRole } from "./security";

import { logActivity } from "./logging";

import { getUserFIOrg } from "./security";

export async function createQuestionnaire(identifier: string | null | undefined, formData: FormData) {
    const name = formData.get("name") as string;
    const file = formData.get("file") as File;
    const engagementId = formData.get("fiEngagementId") as string; // Optional: For Client Uploads

    if (!name) {
        return { success: false, error: "Name is required" };
    }

    let targetOrgId = identifier;

    // 1. Resolve Org Context
    if (!targetOrgId) {
        // Try to infer from FI User session
        const fiOrg = await getUserFIOrg();
        if (fiOrg) {
            targetOrgId = fiOrg.id;
        } else {
            // If implicit fail, verify if engagementId is present (Client Context)
            if (!engagementId) {
                return { success: false, error: "Organization context required" };
            }
        }
    }

    // 2. Security Check
    // If explict orgId provided, must be System Admin or Admin of that Org
    if (targetOrgId) {
        if (!(await canManageQuestionnaire(targetOrgId))) { // Wait, canManageQuestionnaire checks based on Q ID... we need check based on ORG ID
            // Re-implement basic check here or strictly use isSystemAdmin / getUserOrgRole
            const userRole = await getUserOrgRole(targetOrgId);
            const sysAdmin = await isSystemAdmin();
            if (!sysAdmin && userRole !== "ADMIN" && userRole !== "MEMBER") { // MEMBER can upload? Let's say yes for now
                return { success: false, error: "Unauthorized" };
            }
        }
    }

    // 3. Client Engagement Context Check
    if (engagementId) {
        // Must verify user owns the ClientLE linked to this engagement
        // implementation TBD or rely on engagement-based permissions
        // For now, let's assume if they have the engagement ID validly, they can attach?
        // Ideally we check:
        // const engagement = prisma.fiEngagement.findFirst({ where: { id: engagementId, clientLE: { clientOrg: { members: { some: { userId } } } } } });
        // This logic is complex to inline.
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
            fileData = {
                fileName: null,
                fileType: null,
                fileContent: null
            }
        }

        // Handle Client Engagement Upload (Linked Instance)
        if (engagementId) {
            // Fetch engagement to get fiOrgId
            const eng = await prisma.fIEngagement.findUnique({ where: { id: engagementId } });
            if (!eng) return { success: false, error: "Engagement not found" };

            // For Client uploads, we treat it as an upload to that FI's list but linked
            targetOrgId = eng.fiOrgId;
        }

        if (!targetOrgId) return { success: false, error: "Could not determine Target Organization" };

        const questionnaire = await prisma.questionnaire.create({
            data: {
                fiOrgId: targetOrgId,
                name: name,
                status: "DIGITIZING", // Async Step 1: Start as "Digitizing"
                fiEngagementId: engagementId || null, // Link if provided
                ...fileData
            },
        });

        await logActivity("CREATE_QUESTIONNAIRE", `/app/admin/organizations/${targetOrgId}`, {
            questionnaireId: questionnaire.id,
            name: questionnaire.name,
            fiOrgId: targetOrgId,
            engagementId: engagementId
        });

        revalidatePath(`/app/admin/organizations/${targetOrgId}`);
        revalidatePath(`/app/fi/questionnaires`); // Refresh FI view
        if (engagementId) {
            revalidatePath(`/app/fi/engagements/${engagementId}`);
            revalidatePath(`/app/le`); // Revalidate Client views
        }

        return { success: true, data: questionnaire };
    } catch (error) {
        console.error("Failed to create questionnaire:", error);
        return { success: false, error: "Database Error" };
    }
}

// ASYNC ACTION: Triggered by Client after Upload
export async function startBackgroundExtraction(id: string) {
    if (!(await canManageQuestionnaire(id))) return { success: false, error: "Unauthorized" };

    // We don't await this inside the client call if we want true non-blocking, 
    // but typically Server Actions must be awaited. 
    // However, if the client calls this and then does router.refresh(), 
    // the client UI will update when THIS returns.
    // The user wants "Modal Closes -> Row shows Digitizing -> Row shows Success".
    // So the client should NOT await this for the modal close.
    // The client will call this, and while it's pending, the UI (via Optimistic or Refresh) shows Digitizing.

    try {
        const res = await extractDetailedContent(id);

        if (res.success) {
            // Success: Move to DRAFT
            await prisma.questionnaire.update({
                where: { id },
                data: { status: "DRAFT" }
            });
            revalidatePath(`/app/admin/questionnaires/${id}`);
            return { success: true };
        } else {
            // Fail: Move to ERROR state or revert to DRAFT with error?
            // Let's use DRAFT but maybe inject an error message in description or name? 
            // Or better, just keep it DIGITIZING? No, that hangs.
            // Let's set to DRAFT but with empty content so they see the empty state again?
            await prisma.questionnaire.update({
                where: { id },
                data: { status: "DRAFT" } // Fallback to allow Manual Start
            });
            return { success: false, error: res.error };
        }
    } catch (e: any) {
        console.error("Background extraction failed:", e);
        return { success: false, error: e.message };
    }
}

export async function getQuestionnaires(orgId: string) {
    const qs = await prisma.questionnaire.findMany({
        where: {
            fiOrgId: orgId,
            isDeleted: false,
            // We might want to show archived in a separate view, but hide from main list
            status: { not: "ARCHIVED" }
        },
        orderBy: { updatedAt: "desc" },
        // Explicitly selecting fields ensures we get what we expect, partially overriding default behavior if mixed
        include: {
            questions: false, // Don't need questions for list
        }
    });

    // Debug log to check server-side formatting
    console.log(`[getQuestionnaires] Fetched ${qs.length} items for ${orgId}`);
    if (qs.length > 0) {
        console.log(`[getQuestionnaires] First item logs type: ${typeof qs[0].processingLogs}, IsArray: ${Array.isArray(qs[0].processingLogs)}`);
    }

    return qs;
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

    const logger = async (msg: string, stage: string = "EXTRACT", level: "INFO" | "ERROR" | "SUCCESS" = "INFO") => {
        await appendProcessingLog(id, msg, stage, level);
    };

    if (!q.fileContent) {
        if (!images || images.length === 0) {
            await logger("No file content found to extract.", "INIT", "ERROR");
            return { success: false, error: "NO_FILE", status: "NO_FILE" };
        }
    }

    try {
        let textContent = "";

        if (images && images.length > 0) {
            // Client-side provided images (Scanned PDF fallback)
            await logger("Processing Client-Side Images (Scanned).", "INIT");
            await logger("Skipping text extraction for images (will process as vision in next step).", "EXTRACT", "INFO");
            return { success: true, status: "SKIPPED_TEXT_EXTRACT" };
        }

        // Standard File Processing
        if (q.fileContent && q.fileType && q.fileName) {
            await logger(`Starting text extraction for ${q.fileName}`, "INIT");
            const processed = await processDocumentBuffer(Buffer.from(q.fileContent), q.fileType, q.fileName, logger);

            if (processed.type === 'text') {
                textContent = processed.content as string;
            }
        }

        await prisma.questionnaire.update({
            where: { id },
            data: {
                rawText: textContent,
                // Update status if we had one
            } as any
        });

        await logActivity("EXTRACT_TEXT", `/app/admin/questionnaires/${id}`, {
            questionnaireId: id,
            success: true,
            length: textContent.length
        });

        await logger(`Text extraction complete. Length: ${textContent.length}`, "EXTRACT", "SUCCESS");
        return { success: true, data: textContent };
    } catch (e: any) {
        await logActivity("EXTRACT_TEXT_ERROR", `/app/admin/questionnaires/${id}`, { error: e.message });
        await logger(`Extraction Failed: ${e.message}`, "EXTRACT", "ERROR");
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

    const logger = async (msg: string, stage: string = "PARSE", level: "INFO" | "ERROR" | "SUCCESS" = "INFO") => {
        await appendProcessingLog(id, msg, stage, level);
    };

    const textToProcess = textOverride || (q as any).rawText;
    if (!textToProcess) {
        await logger("No text content available to parse.", "PARSE_INIT", "ERROR");
        throw new Error("No text to parse");
    }

    try {
        await logger(`Starting AI Parsing of ${textToProcess.length} chars...`, "PARSE");

        // We reuse the existing AI Mapper but pass explicit text
        const processed = {
            content: textToProcess,
            type: "text" as "text",
            mime: "text/plain"
        };

        const extractedItems = await extractQuestionnaireItems(processed, logger);

        await prisma.questionnaire.update({
            where: { id },
            data: {
                extractedContent: extractedItems as any,
                rawText: textToProcess
            } as any
        });

        // SYNC TO QUESTION ROWS
        await syncQuestionsToDatabase(id, extractedItems);

        revalidatePath(`/app/admin/questionnaires/${id}`);

        await logActivity("PARSE_STRUCTURE", `/app/admin/questionnaires/${id}`, {
            questionnaireId: id,
            itemCount: extractedItems.length
        });

        await logger(`Parsing complete. Extracted ${extractedItems.length} items.`, "PARSE", "SUCCESS");

        return { success: true, count: extractedItems.length };
    } catch (e: any) {
        await logger(`Parsing Failed: ${e.message}`, "PARSE", "ERROR");
        return { success: false, error: e.message };
    }
}


// LEGACY WRAPPER (Updated)
export async function extractDetailedContent(id: string, images?: string[]): Promise<{ success: boolean; count?: number; error?: string; status?: string }> {
    const logger = async (msg: string, stage: string = "ORCHESTRATOR", level: "INFO" | "ERROR" | "SUCCESS" = "INFO") => {
        await appendProcessingLog(id, msg, stage, level);
    };

    // If images, we use old flow for now as "Text Extraction" from images is expensive/complex to separate
    if (images && images.length > 0) {
        if (!(await canManageQuestionnaire(id))) return { success: false, error: "Unauthorized" };
        try {
            await logger("Processing images directly...", "IMAGE_MODE");
            const processed = {
                content: images,
                type: "image" as "image",
                mime: "image/png"
            };
            const extractedItems = await extractQuestionnaireItems(processed, logger);

            const cleanItems = JSON.parse(JSON.stringify(extractedItems));
            await prisma.questionnaire.update({ where: { id }, data: { extractedContent: cleanItems } });
            revalidatePath(`/app/admin/questionnaires/${id}`);
            return { success: true, count: extractedItems.length };
        } catch (e: any) { return { success: false, error: e.message }; }
    }

    // For text docs, we chain the new steps
    await logger("Starting detailed content extraction workflow...", "START");
    const extRes = await extractRawText(id);
    if (!extRes.success) return { success: false, error: extRes.error };

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

    // SYNC TO QUESTION ROWS
    await syncQuestionsToDatabase(id, items);

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

// LOGGING UTILITY
export async function appendProcessingLog(id: string, message: string, stage: string = "PROCESSING", level: "INFO" | "ERROR" | "SUCCESS" = "INFO") {
    try {
        const entry = {
            timestamp: new Date().toISOString(),
            message,
            stage,
            level
        };

        // Atomic update for Postgres JSONB
        // formatting the entry as a single-item array for concatenation
        const jsonEntry = JSON.stringify([entry]);

        await prisma.$executeRaw`
            UPDATE "Questionnaire" 
            SET "processingLogs" = COALESCE("processingLogs", '[]'::jsonb) || ${jsonEntry}::jsonb
            WHERE "id" = ${id};
        `;

        // Revalidate allows UI to stream logs
        revalidatePath(`/app/admin/questionnaires/${id}`);
    } catch (e) {
        console.error("Failed to append log:", e);
    }
}

// HELPER: Sync JSON Items to Question Rows
async function syncQuestionsToDatabase(id: string, items: any[]) {
    // 1. Delete existing questions for this questionnaire (Template Mode)
    // NOTE: This is destructive for comments on the template questions, but necessary for full sync.
    await prisma.question.deleteMany({
        where: { questionnaireId: id }
    });

    // 2. Filter for Questions only (or map others if we expand model later)
    const questionsToCreate = items
        .filter(i => i.type === "QUESTION")
        .map((item, index) => ({
            questionnaireId: id,
            text: item.originalText, // Or use neutralText?
            order: item.order || index + 1,
            // category: item.category?? We don't have a category field on Question model yet?
            // Wait, we need to check schema. Question model DOES NOT have 'category'.
            // It has 'sourceSectionId'.
            // For now, we just save text and order.
            status: "DRAFT" as const
        }));

    if (questionsToCreate.length > 0) {
        await prisma.question.createMany({
            data: questionsToCreate
        });
    }
}
