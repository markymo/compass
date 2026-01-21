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

    // Fetch users and their primary/current org context
    // Ideally we join User -> UserOrgRole -> Org
    // Since we didn't fully sync User table with Clerk yet, we rely on Roles.

    // Get all roles
    const roles = await prisma.userOrganizationRole.findMany({
        include: {
            user: true,
            org: true
        },
        orderBy: { user: { email: 'asc' } }
    });

    return roles.map(r => ({
        userId: r.userId,
        email: r.user.email,
        orgId: r.orgId,
        orgName: r.org.name,
        orgType: r.org.types[0], // simplified for list view
        role: r.role
    }));
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
        // Update or Create role for this target Org
        // We do NOT remove other roles anymore.
        await tx.userOrganizationRole.upsert({
            where: {
                userId_orgId: {
                    userId: targetUserId,
                    orgId: targetOrgId
                }
            },
            create: {
                userId: targetUserId,
                orgId: targetOrgId,
                role: "ADMIN"
            },
            update: {
                role: "ADMIN"
            }
        });
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
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            name: true,
            status: true,
            updatedAt: true,
            createdAt: true,
            fileName: true,
            ownerOrgId: true,
            fiOrg: {
                select: { name: true }
            }
        }
    });
}
