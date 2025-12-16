"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./admin";
import { revalidatePath } from "next/cache";

// 1. Create Organization (Admin Only)
export async function createOrganization(name: string, types: ("CLIENT" | "FI" | "SYSTEM")[]) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const org = await prisma.organization.create({
            data: {
                name,
                types: types // Use the array directly
            }
        });
        revalidatePath("/app/admin/organizations");
        return { success: true, data: org };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to create organization" };
    }
}

// 2. List All Organizations (Admin Only)
export async function getOrganizations() {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return [];

    return await prisma.organization.findMany({
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { members: true }
            }
        }
    });
}

// 3. Get Organization Details (Admin Only)
export async function getOrganizationDetails(orgId: string) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return null;

    return await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
            members: {
                include: {
                    user: true
                }
            },
            // Include related entities count if useful
            clientLEs: {
                select: { id: true } // just count
            }
        }
    });
}

// 4. Add Member to Organization (Admin Only)
export async function addMemberToOrg(orgId: string, email: string, role: "ADMIN" | "MEMBER" | "VIEWER" = "MEMBER") {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        // Find or Create User
        // Note: In a real app with Clerk, we might want to use Clerk API to check if user exists or invite them.
        // For this MVP, we create a placeholder in our DB.

        let user = await prisma.user.findFirst({
            where: { email: email }
        });

        if (!user) {
            // Create placeholder
            // ID: We can generate a UUID locally or let Prisma do it if schema allows, 
            // but schema says String ID. We usually use Clerk ID.
            // WORKAROUND: Generate a placeholder ID "placeholder_..." so we know to link it later?
            // Or just use a UUID.
            const { v4: uuidv4 } = require('uuid');
            user = await prisma.user.create({
                data: {
                    id: `invite_${uuidv4()}`,
                    email: email
                }
            });
        }

        // Check if already member of THIS or ANOTHER org?
        // Our constraint is 1 active org role per user usually, but Schema allows many?
        // Schema: key [userId, orgId].
        // But logic elsewhere assumes 1 role.
        // Let's assume we OVERWRITE valid org for now (Move user).

        // Remove existing roles to enforce 1-org policy for MVP simplicity
        await prisma.userOrganizationRole.deleteMany({
            where: { userId: user.id }
        });

        // Create new role
        await prisma.userOrganizationRole.create({
            data: {
                userId: user.id,
                orgId,
                role
            }
        });

        revalidatePath(`/app/admin/organizations/${orgId}`);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to add member" };
    }
}
