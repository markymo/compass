"use server";
import { put } from "@vercel/blob";
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSystemAdmin } from "./security";
import { DocumentService } from "@/lib/documents/DocumentService";
import { getIdentity } from "@/lib/auth";

// 1. Export re-export or just use local one? 
// The plan said refactor from admin.ts, so let's import it.
export { isSystemAdmin };

// 2. Get All Users (for Admin Dashboard)
export async function getAllUsers() {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return [];

    // Fetch users and their primary/current org context (Party)
    // We fetch memberships that have an organizationId (Party scopes only for this view)

    // Fetch ALL users and their memberships
    const users = await prisma.user.findMany({
        orderBy: { email: 'asc' },
        include: {
            memberships: {
                include: {
                    organization: true,
                    clientLE: true // Include ClientLE for workspace context
                }
            }
        }
    });

    // Map to User View Model
    const userViewModels = users.map((u: any) => {
        const mappedMemberships = u.memberships.map((m: any) => {
            if (m.organization) {
                return {
                    orgId: m.organization.id,
                    orgName: m.organization.name,
                    orgType: m.organization.types[0],
                    role: m.role
                };
            } else if (m.clientLE) {
                // Handle Workspace Memberships
                return {
                    orgId: m.clientLE.id,
                    orgName: m.clientLE.name,
                    orgType: "WORKSPACE", // Distinct type for UI
                    role: m.role
                };
            }
            return null;
        }).filter((m: any) => m !== null); // Remove invalid/empty memberships

        // Sort Memberships: Type DESC (SYSTEM > FI > CLIENT > WORKSPACE), Name ASC
        mappedMemberships.sort((a: any, b: any) => {
            // 1. Type DESC
            if (a.orgType < b.orgType) return 1;
            if (a.orgType > b.orgType) return -1;
            // 2. Name ASC
            if (a.orgName < b.orgName) return -1;
            if (a.orgName > b.orgName) return 1;
            return 0;
        });

        return {
            userId: u.id,
            email: u.email,
            memberships: mappedMemberships
        };
    });

    return userViewModels;
}

// 3. Promote/Demote/Switch Org Type (Super Admin Action)
export async function updateUserOrg(targetUserId: string, targetOrgId: string, force = false) {
    if (!force) {
        const isAdmin = await isSystemAdmin();
        if (!isAdmin) return { success: false, error: "Unauthorized" };
    }

    // Move user to this org
    // For v1 simplicity, we delete old role and create new one (since we enforce 1 role per user)
    // Transactional

    await prisma.$transaction(async (tx: any) => {
        // Update or Create Membership for this target Org (Party)

        const existing = await tx.membership.findFirst({
            where: {
                userId: targetUserId,
                organizationId: targetOrgId,
                clientLEId: null
            }
        });

        if (existing) {
            await tx.membership.update({
                where: { id: existing.id },
                data: { role: "ORG_ADMIN" }
            });
        } else {
            await tx.membership.create({
                data: {
                    userId: targetUserId,
                    organizationId: targetOrgId,
                    role: "ORG_ADMIN"
                }
            });
        }
    });

    revalidatePath("/app/admin/users");
    return { success: true };
}

// 4. Create System Org (Bootstrap) - if none exists
export async function bootstrapSystemOrg() {
    const sysOrg = await prisma.organization.findFirst({
        where: { types: { has: "SYSTEM" } }
    });

    if (!sysOrg) {
        return await prisma.organization.create({
            data: {
                name: "Compass System Admin",
                types: ["SYSTEM"]
            }
        });
    }
    return sysOrg;
}
// 5. Get All Questionnaires (Admin)
export async function getAllQuestionnaires() {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return [];

    return await prisma.questionnaire.findMany({
        where: {
            isDeleted: false,
            status: { not: "ARCHIVED" }
        },
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            name: true,
            status: true,
            updatedAt: true,
            createdAt: true,
            mappings: true,
            fileName: true,
            fileUrl: true,
            ownerOrgId: true,
            fiEngagementId: true,
            kind: true,
            visibility: true,
            fiOrg: {
                select: { name: true }
            },
            fiEngagement: {
                select: {
                    org: { select: { name: true, shortCode: true } },
                    clientLE: { select: { id: true, name: true } }
                }
            }
        }
    });
}

// 6. Save Uploaded Source Document directly to DB bytes
export async function uploadSourceDocument(formData: FormData) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file provided" };

    try {
        const sysOrg = await bootstrapSystemOrg();
        const identity = await getIdentity();
        const uploadedById = identity?.userId || "system";

        // 1. Upload to private Vercel Blob and create canonical Document record
        const document = await DocumentService.uploadServerSideDocument({
            file,
            filename: file.name,
            mimeType: file.type || 'application/pdf',
            uploadedById,
            ownerOrgId: sysOrg.id,
            pathPrefix: `questionnaires/${sysOrg.id}`
        });

        // 3. Create Questionnaire linked to Document
        const questionnaire = await prisma.questionnaire.create({
            data: {
                name: file.name.replace(/\.[^/.]+$/, ""), // Strip extension
                fileName: file.name,
                sourceDocumentId: document.id,
                fiOrgId: sysOrg.id,
                ownerOrgId: sysOrg.id,
                status: "UPLOADED"
            }
        });

        revalidatePath("/app/admin/questionnaires");
        return { success: true, questionnaireId: questionnaire.id, questionnaireName: questionnaire.name };

    } catch (error: any) {
        console.error("Upload save failed:", error);
        return { success: false, error: error.message || "Upload save failed" };
    }
}
