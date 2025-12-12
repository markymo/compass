"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// 1. Check if Current User is System Admin
export async function isSystemAdmin() {
    const { userId } = await auth();
    if (!userId) return false;

    // Check for an active role in a SYSTEM org
    const adminRole = await prisma.userOrganizationRole.findFirst({
        where: {
            userId: userId,
            org: {
                type: "SYSTEM"
            }
        },
        include: { org: true }
    });

    return !!adminRole;
}

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
        orgType: r.org.type,
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
        await tx.userOrganizationRole.deleteMany({
            where: { userId: targetUserId }
        });

        await tx.userOrganizationRole.create({
            data: {
                userId: targetUserId,
                orgId: targetOrgId,
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
        where: { type: "SYSTEM" }
    });

    if (!sysOrg) {
        return await prisma.organization.create({
            data: {
                name: "Compass System Admin",
                type: "SYSTEM"
            }
        });
    }
    return sysOrg;
}
