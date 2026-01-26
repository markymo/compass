"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./admin";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from 'uuid';

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
export async function getOrganizations(filterType?: string) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return [];

    const where: any = {};
    if (filterType) {
        where.types = { has: filterType as any };
    }

    return await prisma.organization.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { memberships: true }
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
            memberships: {
                include: {
                    user: true
                }
            },
            // Include related entities count if useful
            ownedLEs: {
                where: { endAt: null },
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
        let user = await prisma.user.findFirst({
            where: { email: email }
        });


        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: `invite_${uuidv4()}`,
                    email: email
                }
            });
        }

        // Create or Update Membership for this Scope (Party)
        // Unique constraint: [userId, organizationId, clientLEId]
        // Here, clientLEId is implicitly null (Prisma handles null in unique index logic differently on DBs, 
        // but typically (USER, ORG, null) is unique row).

        // However, Prisma upsert needs the specific unique composite key name or fields.
        // We defined @@unique([userId, organizationId, clientLEId]).
        // But clientLEId is nullable. Prisma doesn't support null in composite unique identifiers for UPSERT unless all fields are non-null?
        // Actually, we can just use findFirst -> update/create path to be safe.

        const existing = await prisma.membership.findFirst({
            where: {
                userId: user.id,
                organizationId: orgId,
                clientLEId: null
            }
        });

        if (existing) {
            await prisma.membership.update({
                where: { id: existing.id },
                data: { role }
            });
        } else {
            await prisma.membership.create({
                data: {
                    userId: user.id,
                    organizationId: orgId,
                    role
                }
            });
        }

        revalidatePath(`/app/admin/organizations/${orgId}`);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to add member" };
    }
}
