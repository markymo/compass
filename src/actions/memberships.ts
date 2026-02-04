"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export type UpdatePermissionData = {
    targetUserId: string;
    scopeType: "ORG" | "LE";
    scopeId: string;
    role: "ORG_ADMIN" | "LE_ADMIN" | "LE_USER" | "NONE";
};

export async function updateUserPermission(data: UpdatePermissionData) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    // 1. Authorization Check (Can current user manage credentials?)
    // Basic Rule: Must be ORG_ADMIN of the owning Org to change permissions.
    // For LE changes, ORG_ADMIN or specific LE_ADMIN could work, but let's stick to Org Admin for simplicity first as per 'Client Admin' requirement.

    // Resolve the Organization ID to check admin status against
    let orgIdToCheck = "";
    if (data.scopeType === "ORG") {
        orgIdToCheck = data.scopeId;
    } else {
        // Find the Org that owns this LE (Active Owner)
        const leOwner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId: data.scopeId, endAt: null }
        });
        if (!leOwner) return { success: false, error: "Legal Entity has no owner." };
        orgIdToCheck = leOwner.partyId;
    }

    const requesterMembership = await prisma.membership.findFirst({
        where: {
            userId,
            organizationId: orgIdToCheck,
            role: "ORG_ADMIN" // Strict Org Admin requirement for now
        }
    });

    if (!requesterMembership) {
        return { success: false, error: "Unauthorized: You must be a Client Admin to manage permissions." };
    }

    // 2. Self-Demotion Prevention
    if (data.targetUserId === userId) {
        if (data.scopeType === "ORG" && data.role === "NONE") {
            return { success: false, error: "You cannot remove your own Client Admin access. Ask another admin to do it." };
        }
    }

    try {
        if (data.role === "NONE") {
            // REMOVE Membership
            const whereClause: any = {
                userId: data.targetUserId,
            };
            if (data.scopeType === "ORG") whereClause.organizationId = data.scopeId;
            else whereClause.clientLEId = data.scopeId;

            await prisma.membership.deleteMany({
                where: whereClause
            });
        } else {
            // UPSERT Membership (Add or Update)
            // We need to handle the unique constraint manually since arguments differ slightly
            const query: any = { userId: data.targetUserId };
            if (data.scopeType === "ORG") {
                query.organizationId = data.scopeId;
                query.clientLEId = null; // Important for uniqueness
            } else {
                query.clientLEId = data.scopeId;
                query.organizationId = null; // Important
            }

            // Check if exists using findFirst (to get ID) or deleteMany then create? 
            // Upsert needs usage of @@unique.
            // unique input: { userId_organizationId_clientLEId: ... }
            // But nulls in unique constraints in Prisma/Postgres can be tricky depending on setup.
            // Let's use deleteMany + create to be safe and atomic-ish, or findFirst -> update/create.

            const existing = await prisma.membership.findFirst({ where: query });

            if (existing) {
                await prisma.membership.update({
                    where: { id: existing.id },
                    data: { role: data.role }
                });
            } else {
                await prisma.membership.create({
                    data: {
                        ...query,
                        role: data.role
                    }
                });
            }
        }

        revalidatePath(`/app/clients/${orgIdToCheck}/team`);
        return { success: true };

    } catch (e) {
        console.error("Update Permission Failed:", e);
        return { success: false, error: "Database error occurred." };
    }
}
