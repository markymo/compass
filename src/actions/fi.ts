"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client"; // Added import

// 1. Get List of FIs
export async function getFIs() {
    const fis = await prisma.organization.findMany({
        where: { types: { has: "FI" } },
        orderBy: { name: 'asc' }
    });
    return fis;
}

// 2. Create an FI (Helper)
export async function createFI(name: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const fi = await prisma.organization.create({
        data: {
            name,
            types: ["FI"],
            members: {
                create: {
                    userId,
                    role: "ADMIN"
                }
            }
        }
    });
    revalidatePath("/app/admin/mapper");
    return { success: true, data: fi };
}

// 3. Save Mapping as FISchema
export async function saveFIMapping(fiOrgId: string, mapping: any[]) {
    // 1. Get Active Master Schema
    const activeSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true }
    });
    if (!activeSchema) return { success: false, error: "No active master schema" };

    // 2. Format as Overlay Definition
    const overlay = {
        mappings: mapping
    };

    // 3. Create or Update FISchema
    await prisma.fISchema.create({
        data: {
            fiOrgId,
            masterSchemaId: activeSchema.id,
            overlayDefinition: overlay
        }
    });

    return { success: true };
}

// --- FI User Actions ---

// Check if current user belongs to an FI
export async function getFIOganization() {
    const { userId } = await auth();
    if (!userId) return null;

    const role = await prisma.userOrganizationRole.findFirst({
        where: {
            userId: userId,
            org: { types: { has: "FI" } }
        },
        include: { org: true }
    });

    return role?.org || null;
}

export async function isFIUser() {
    const org = await getFIOganization();
    return !!org;
}

// Create a new Questionnaire (Draft)
// Create a new Questionnaire (Draft)
export async function uploadQuestionnaire(formData: FormData) {
    const org = await getFIOganization();
    if (!org) return { success: false, error: "Unauthorized" };

    const name = formData.get("name") as string;
    const file = formData.get("file") as File;

    if (!name || !file) {
        return { success: false, error: "Missing name or file" };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer as any);

        const q = await prisma.questionnaire.create({
            data: {
                fiOrgId: org.id,
                name,
                fileName: file.name,
                fileType: file.type,
                fileContent: buffer,
                status: "DRAFT"
            }
        });

        revalidatePath("/app/fi/questionnaires");
        return { success: true, data: q };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to create questionnaire" };
    }
}

// Get Questionnaires for the current FI
export async function getFIQuestionnaires() {
    const org = await getFIOganization();
    if (!org) return [];

    return await prisma.questionnaire.findMany({
        where: {
            fiOrgId: org.id,
            isDeleted: false
        },
        orderBy: { updatedAt: 'desc' },
    });
}

// --- New Dashboard Actions ---

// 1. Get Dashboard Overview Stats
export async function getFIDashboardStats() {
    const org = await getFIOganization();
    if (!org) return null;

    const [questionnaires, engagements, queries] = await Promise.all([
        prisma.questionnaire.count({ where: { fiOrgId: org.id } }),
        prisma.fIEngagement.count({ where: { fiOrgId: org.id } }),
        prisma.query.count({
            where: {
                engagement: { fiOrgId: org.id },
                status: "OPEN"
            }
        })
    ]);

    return {
        questionnaires,
        engagements,
        queries
    };
}


// 2. Get Active Engagements with progress
// Define the return type explicitly to help IDEs
export type ApplicationEngagement = Prisma.FIEngagementGetPayload<{
    include: {
        clientLE: true,
        // We override questionnaires in the return, so we don't include it here to avoid conflict in partials?
        // Actually, let's just use the base payload and extend it.
    }
}> & {
    questionnaires: Prisma.QuestionnaireGetPayload<{
        select: { id: true, name: true, status: true, questions: true }
    }>[]
};

export async function getFIEngagements(): Promise<ApplicationEngagement[]> {
    const org = await getFIOganization();
    if (!org) return [];

    const engagements = await prisma.fIEngagement.findMany({
        where: {
            fiOrgId: org.id,
            isDeleted: false,
            status: { not: "ARCHIVED" }
        },
        include: {
            clientLE: true,
            questionnaireInstances: { // Fetch Instances instead of Templates
                select: {
                    id: true,
                    name: true,
                    status: true,
                    questions: true // We might need questions for progress calc
                }
            }
        },
        // orderBy: { updatedAt: 'desc' } // Removed as not in schema
    });

    // Map instances to 'questionnaires' property for frontend compatibility
    return engagements.map(e => ({
        ...e,
        questionnaires: e.questionnaireInstances
    }));
}

// 2.b Get Questions for Dashboard (Kanban Items)
export async function getFIDashboardQuestions(filters?: { clientLEId?: string; questionnaireName?: string }) {
    const org = await getFIOganization();
    if (!org) return [];

    const where: any = {
        questionnaire: {
            fiOrgId: org.id,
            fiEngagementId: { not: null }, // Only fetch Instances (Answers), not Templates
            // Filter by Client via Engagement
            fiEngagement: filters?.clientLEId ? {
                clientLEId: filters.clientLEId
            } : undefined,
            // Filter by Questionnaire Name (Instance Name or Original Name? Usually Instance Name matches Template)
            name: filters?.questionnaireName ? {
                contains: filters.questionnaireName, // Loose match or exact? Let's do exact if possible, or contains for flexibility
                mode: 'insensitive'
            } : undefined
        }
    };

    // Remove undefined keys
    if (!where.questionnaire.fiEngagement) delete where.questionnaire.fiEngagement;
    if (!where.questionnaire.name) delete where.questionnaire.name;

    const questions = await prisma.question.findMany({
        where,
        include: {
            questionnaire: {
                include: {
                    fiEngagement: {
                        include: { clientLE: true }
                    }
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    return questions;
}

// 3. Get Query Inbox
export async function getFIQueries() {
    const org = await getFIOganization();
    if (!org) return [];

    return await prisma.query.findMany({
        where: {
            engagement: { fiOrgId: org.id },
            status: "OPEN"
        },
        include: {
            engagement: {
                include: { clientLE: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}
// 4. Get Single Engagement by ID
export async function getFIEngagementById(id: string): Promise<ApplicationEngagement | null> {
    const org = await getFIOganization();
    if (!org) return null;

    const engagement = await prisma.fIEngagement.findFirst({
        where: {
            id,
            fiOrgId: org.id
        },
        include: {
            clientLE: true,
            questionnaireInstances: {
                include: {
                    questions: {
                        orderBy: { order: 'asc' }
                    }
                }
            }
        }
    });

    if (!engagement) return null;

    return {
        ...engagement,
        questionnaires: engagement.questionnaireInstances
    };
}

// 5. Assign Questionnaire to Engagement (Deep Clone / Snapshot)
export async function assignQuestionnaireToEngagement(engagementId: string, templateId: string) {
    const org = await getFIOganization();
    if (!org) return { success: false, error: "Unauthorized" };

    // 1. Fetch Template and its Questions
    const template = await prisma.questionnaire.findUnique({
        where: { id: templateId, fiOrgId: org.id },
        include: { questions: true }
    });

    if (!template) return { success: false, error: "Template not found" };

    try {
        // 2. Create Instance (Copy of Questionnaire) linked to Engagement
        const instance = await prisma.questionnaire.create({
            data: {
                fiOrgId: org.id,
                name: template.name, // Can append (Copy) if desired, but ideally kept same name for UI
                status: "PENDING",
                fileName: template.fileName,
                fileType: template.fileType,
                fileContent: template.fileContent,
                mappings: template.mappings ?? undefined, // Handle null vs undefined for Prisma
                extractedContent: template.extractedContent ?? undefined,
                rawText: template.rawText,
                fiEngagementId: engagementId, // The Link!
                // Copy Privacy settings if needed
                ownerOrgId: template.ownerOrgId,

                // 3. Deep Clone Questions (Snapshot)
                questions: {
                    create: template.questions.map(q => ({
                        text: q.text,
                        order: q.order,
                        status: "DRAFT",
                        sourceSectionId: q.sourceSectionId,
                        // Note: We do NOT copy 'answer' or 'activities' or 'comments' as this is a fresh start
                    }))
                }
            }
        });

        // 4. (Optional) Also link as a "Template" reference?
        // Actually, we probably don't need to double-link if we rely on Instances.
        // But for "Which questionnaires are part of this?" queries to work with existing code
        // that uses the Many-to-Many relation, we might need to think about backward compat.
        // For now, let's assume the UI will switch to look at 'questionnaireInstances'.

        revalidatePath(`/app/fi/engagements/${engagementId}`);
        return { success: true, data: instance };

    } catch (e: any) {
        console.error("Failed to assign questionnaire:", e);
        return { success: false, error: "Database error" };
    }
}

// 6. Archive / Delete Engagement
export async function deleteEngagement(id: string) {
    const org = await getFIOganization();
    if (!org) return { success: false, error: "Unauthorized" };

    try {
        await prisma.fIEngagement.update({
            where: { id, fiOrgId: org.id },
            data: { isDeleted: true }
        });
        revalidatePath("/app/fi");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to delete engagement" };
    }
}

export async function archiveEngagement(id: string) {
    const org = await getFIOganization();
    if (!org) return { success: false, error: "Unauthorized" };

    try {
        await prisma.fIEngagement.update({
            where: { id, fiOrgId: org.id },
            data: { status: "ARCHIVED" }
        });
        revalidatePath("/app/fi");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to archive engagement" };
    }
}
