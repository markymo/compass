"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// 1. Get List of FIs
export async function getFIs() {
    const fis = await prisma.organization.findMany({
        where: { type: "FI" },
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
            type: "FI",
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
            org: { type: "FI" }
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
export async function uploadQuestionnaire(
    name: string,
    fileName: string,
    fileType: string
) {
    const org = await getFIOganization();
    if (!org) return { success: false, error: "Unauthorized" };

    try {
        const q = await prisma.questionnaire.create({
            data: {
                fiOrgId: org.id,
                name,
                fileName,
                fileType,
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
            // engagements: true 
        }
    });
}
