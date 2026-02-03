"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
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
            memberships: {
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
// Check if current user belongs to an FI
export async function getFIOganization(fiOrgId?: string) {
    const { userId } = await auth();
    if (!userId) return null;

    if (fiOrgId) {
        const membership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: fiOrgId,
                organization: { types: { has: "FI" } }
            },
            include: { organization: true }
        });
        return membership?.organization || null;
    }

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get("compass_active_org")?.value;

    if (activeOrgId) {
        const activeMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: activeOrgId,
                organization: { types: { has: "FI" } }
            },
            include: { organization: true }
        });
        if (activeMembership) return activeMembership.organization;
    }

    const membership = await prisma.membership.findFirst({
        where: {
            userId: userId,
            organization: { types: { has: "FI" } }
        },
        include: { organization: true }
    });

    return membership?.organization || null;
}

export async function isFIUser() {
    const org = await getFIOganization();
    return !!org;
}

// Create a new Questionnaire (Draft)
// Create a new Questionnaire (Draft)
export async function uploadQuestionnaire(formData: FormData) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    let orgId = formData.get("fiOrgId") as string;

    if (!orgId) {
        // Try to default if user has only one FI
        const memberships = await prisma.membership.findMany({
            where: { userId, organization: { types: { has: "FI" } } },
            select: { organizationId: true }
        });
        if (memberships.length === 1 && memberships[0].organizationId) {
            orgId = memberships[0].organizationId;
        } else {
            return { success: false, error: "Ambiguous context: Please specify Target FI Organization" };
        }
    }

    // Verify permission
    const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: orgId, organization: { types: { has: "FI" } } }
    });
    if (!membership) return { success: false, error: "Unauthorized for this Organization" };

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
                fiOrgId: orgId,
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
// 1. Get Dashboard Overview Stats
export async function getFIDashboardStats(fiOrgId?: string) {
    const { userId } = await auth();
    if (!userId) return null;

    let targetFiOrgIds: string[] = [];

    if (fiOrgId) {
        // Verify access to specific FI
        const membership = await prisma.membership.findFirst({
            where: { userId, organizationId: fiOrgId, organization: { types: { has: "FI" } } }
        });
        if (!membership) return null;
        targetFiOrgIds = [fiOrgId];
    } else {
        // Get all FI memberships
        const memberships = await prisma.membership.findMany({
            where: {
                userId,
                organization: { types: { has: "FI" } },
                organizationId: { not: null }
            },
            select: { organizationId: true }
        });
        targetFiOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean) as string[];
    }

    if (targetFiOrgIds.length === 0) return null;

    const [questionnaires, engagements, queries] = await Promise.all([
        prisma.questionnaire.count({ where: { fiOrgId: { in: targetFiOrgIds }, isDeleted: false } }),
        prisma.fIEngagement.count({ where: { fiOrgId: { in: targetFiOrgIds }, isDeleted: false, status: { not: "ARCHIVED" } } }),
        prisma.query.count({
            where: {
                engagement: { fiOrgId: { in: targetFiOrgIds } },
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
        clientLE: {
            include: { owners: { include: { party: true } } }
        },
        org: true,
        // We override questionnaires in the return, so we don't include it here to avoid conflict in partials?
        // Actually, let's just use the base payload and extend it.
    }
}> & {
    questionnaires: Prisma.QuestionnaireGetPayload<{
        select: { id: true, name: true, status: true, questions: true }
    }>[]
};

export async function getFIEngagements(fiOrgId?: string): Promise<ApplicationEngagement[]> {
    const { userId } = await auth();
    if (!userId) return [];

    let targetFiOrgIds: string[] = [];

    if (fiOrgId) {
        const membership = await prisma.membership.findFirst({
            where: { userId, organizationId: fiOrgId, organization: { types: { has: "FI" } } }
        });
        if (!membership) return [];
        targetFiOrgIds = [fiOrgId];
    } else {
        const memberships = await prisma.membership.findMany({
            where: {
                userId,
                organization: { types: { has: "FI" } },
                organizationId: { not: null }
            },
            select: { organizationId: true }
        });
        targetFiOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean) as string[];
    }

    if (targetFiOrgIds.length === 0) return [];

    const engagements = await prisma.fIEngagement.findMany({
        where: {
            fiOrgId: { in: targetFiOrgIds },
            isDeleted: false,
            status: { not: "ARCHIVED" },
            clientLE: { isDeleted: false }
        },
        include: {
            clientLE: {
                include: { owners: { where: { endAt: null }, include: { party: true } } }
            },
            org: true,
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
export async function getFIDashboardQuestions(filters?: { clientLEId?: string; questionnaireName?: string; fiOrgId?: string }) {
    const { userId } = await auth();
    if (!userId) return [];

    let targetFiOrgIds: string[] = [];

    if (filters?.fiOrgId) {
        const membership = await prisma.membership.findFirst({
            where: { userId, organizationId: filters.fiOrgId, organization: { types: { has: "FI" } } }
        });
        if (!membership) return [];
        targetFiOrgIds = [filters.fiOrgId];
    } else {
        const memberships = await prisma.membership.findMany({
            where: { userId, organization: { types: { has: "FI" } }, organizationId: { not: null } },
            select: { organizationId: true }
        });
        targetFiOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean) as string[];
    }

    if (targetFiOrgIds.length === 0) return [];

    const where: any = {
        questionnaire: {
            fiOrgId: { in: targetFiOrgIds },
            fiEngagement: filters?.clientLEId ? {
                clientLEId: filters.clientLEId
            } : undefined,
            name: filters?.questionnaireName ? {
                contains: filters.questionnaireName,
                mode: 'insensitive'
            } : undefined
        }
    };

    if (!where.questionnaire.fiEngagement) delete where.questionnaire.fiEngagement;
    if (!where.questionnaire.name) delete where.questionnaire.name;

    return await prisma.question.findMany({
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
}

// 3. Get Query Inbox
export async function getFIQueries() {
    const { userId } = await auth();
    if (!userId) return [];

    const memberships = await prisma.membership.findMany({
        where: { userId, organization: { types: { has: "FI" } }, organizationId: { not: null } },
        select: { organizationId: true }
    });
    const fiOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean) as string[];
    if (fiOrgIds.length === 0) return [];

    return await prisma.query.findMany({
        where: {
            engagement: { fiOrgId: { in: fiOrgIds } },
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
    const { userId } = await auth();
    if (!userId) return null;

    // 1. Get all Org IDs where I am a member
    const myMemberships = await prisma.membership.findMany({
        where: {
            userId,
            organizationId: { not: null }
        },
        include: { organization: true }
    });

    const isSystemAdmin = myMemberships.some((m: any) => m.organization?.types.includes("SYSTEM"));
    const myOrgIds = myMemberships.map((m: any) => m.organizationId).filter(Boolean) as string[];

    if (!isSystemAdmin && myOrgIds.length === 0) return null;

    // 2. Find Engagement
    const whereClause: any = { id };
    if (!isSystemAdmin) {
        whereClause.fiOrgId = { in: myOrgIds };
    }

    const engagement = await prisma.fIEngagement.findFirst({
        where: whereClause,
        include: {
            clientLE: {
                include: { owners: { where: { endAt: null }, include: { party: true } } }
            },
            org: true,
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
// 5. Assign Questionnaire to Engagement (Deep Clone / Snapshot)
export async function assignQuestionnaireToEngagement(engagementId: string, templateId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    // Derive Org from Engagement
    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        select: { fiOrgId: true }
    });
    if (!engagement) return { success: false, error: "Engagement not found" };

    // Check permission
    const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: engagement.fiOrgId }
    });
    if (!membership) return { success: false, error: "Unauthorized" };

    // 1. Fetch Template and its Questions (Ensure template belongs to SAME Org)
    const template = await prisma.questionnaire.findUnique({
        where: { id: templateId, fiOrgId: engagement.fiOrgId },
        include: { questions: true }
    });

    if (!template) return { success: false, error: "Template not found or mismatch" };

    try {
        // 2. Create Instance (Copy of Questionnaire) linked to Engagement
        const instance = await prisma.questionnaire.create({
            data: {
                fiOrgId: engagement.fiOrgId,
                name: template.name, // Can append (Copy) if desired, but ideally kept same name for UI
                status: "SHARED",
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

        revalidatePath(`/app/fi/engagements/${engagementId}`);
        return { success: true, data: instance };

    } catch (e: any) {
        console.error("Failed to assign questionnaire:", e);
        return { success: false, error: "Database error" };
    }
}

// 6. Archive / Delete Engagement
// 6. Archive / Delete Engagement
// 6. Delete Engagement
export async function deleteEngagement(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const engagement = await prisma.fIEngagement.findUnique({ where: { id }, select: { fiOrgId: true } });
    if (!engagement) return { success: false, error: "Not found" };

    const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: engagement.fiOrgId }
    });
    if (!membership) return { success: false, error: "Unauthorized" };

    try {
        // Cascade: Delete linked Questionnaire Instances
        await prisma.questionnaire.updateMany({
            where: { fiEngagementId: id },
            data: { isDeleted: true }
        });

        await prisma.fIEngagement.update({
            where: { id }, // Already guarded by check above
            data: { isDeleted: true }
        });
        revalidatePath("/app/fi");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to delete engagement" };
    }
}

export async function archiveEngagement(id: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const engagement = await prisma.fIEngagement.findUnique({ where: { id }, select: { fiOrgId: true } });
    if (!engagement) return { success: false, error: "Not found" };

    const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: engagement.fiOrgId }
    });
    if (!membership) return { success: false, error: "Unauthorized" };

    try {
        await prisma.fIEngagement.update({
            where: { id },
            data: { status: "ARCHIVED" }
        });
        revalidatePath("/app/fi");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to archive engagement" };
    }
}
