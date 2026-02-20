"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSystemAdmin } from "./security";

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
    const userViewModels = users.map(u => {
        const mappedMemberships = u.memberships.map(m => {
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
        }).filter(m => m !== null); // Remove invalid/empty memberships

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

    await prisma.$transaction(async (tx) => {
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
                data: { role: "ADMIN" }
            });
        } else {
            await tx.membership.create({
                data: {
                    userId: targetUserId,
                    organizationId: targetOrgId,
                    role: "ADMIN"
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
        distinct: ['name'],
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            name: true,
            status: true,
            updatedAt: true,
            createdAt: true,
            mappings: true,
            fileName: true,
            ownerOrgId: true,
            fiOrg: {
                select: { name: true }
            }
        }
    });
}
