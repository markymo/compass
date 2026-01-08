"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

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
        where: { fiOrgId: org.id },
        orderBy: { updatedAt: 'desc' },
        include: {
            engagements: true
        }
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
export async function getFIEngagements() {
    const org = await getFIOganization();
    if (!org) return [];

    const engagements = await prisma.fIEngagement.findMany({
        where: { fiOrgId: org.id },
        include: {
            clientLE: true,
            questionnaires: {
                select: {
                    id: true,
                    name: true,
                    // We can't select json content effectively for deeper logic here easily without fetching it
                    // For now, we'll just show which questionnaires are assigned
                }
            }
        },
        // orderBy: { updatedAt: 'desc' } // Removed as FIEngagement doesn't have updatedAt yet?
    });

    return engagements;
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
