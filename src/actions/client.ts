"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// Helper to get or create the user's Client Organization
// Helper to get or create the user's Client Organization
export async function ensureUserOrg(userId: string, userEmail: string = "") {
    // 0. Fallback: If email is missing (failed session claim), fetch from Clerk directly
    if (!userEmail || userEmail === "unknown@demo.com") {
        const clerkUser = await currentUser();
        if (clerkUser?.emailAddresses?.[0]) {
            userEmail = clerkUser.emailAddresses[0].emailAddress;
        }
    }

    // 1. Self-Heal Email (if we have a better one now)
    if (userEmail && userEmail !== "unknown@demo.com") {
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (currentUser && currentUser.email === "unknown@demo.com") {
            console.log(`[ensureUserOrg] Healing user email for ${userId} to ${userEmail}`);
            await prisma.user.update({
                where: { id: userId },
                data: { email: userEmail }
            });
        }
    }

    // 1. Check all roles
    const roles = await prisma.userOrganizationRole.findMany({
        where: { userId },
        include: { org: true }
    });

    // console.log(`[ensureUserOrg] Found ${roles.length} roles for ${userId}`);

    if (roles.length > 0) {
        // Priority 1: System Admin
        const systemRole = roles.find(r => r.org.types.includes("SYSTEM"));
        if (systemRole) return systemRole.org;

        // Priority 2: Any other (e.g. Client)
        return roles[0].org;
    }

    // 2. If not, AUTO-CREATE one (for this demo/v1)
    console.log(`[ensureUserOrg] No roles found for ${userId}. Auto-creating Client Org.`);

    // Ensure User exists
    await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email: userEmail || "unknown@demo.com" },
        update: {}
    });

    const newOrg = await prisma.organization.create({
        data: {
            name: userEmail ? `${userEmail.split('@')[0]}'s Corp` : "My Demo Client",
            types: ["CLIENT"],
            members: {
                create: {
                    userId: userId,
                    role: "ADMIN"
                }
            }
        }
    });

    return newOrg;
}

// 1. Get List of Client LEs
export async function getClientLEs() {
    const { userId, sessionClaims } = await auth();
    if (!userId) return [];

    // Get the user's Org
    // We use sessionClaims or just fetch from DB. 
    // For V1 demo, let's fetch/create on fly.
    const email = (sessionClaims?.email as string) || "";
    const org = await ensureUserOrg(userId, email);

    return await prisma.clientLE.findMany({
        where: {
            clientOrgId: org.id
        },
        orderBy: { createdAt: 'desc' },
    });
}

// 2. Create a new LE
export async function createClientLE(data: { name: string; jurisdiction: string }) {
    const { userId, sessionClaims } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const email = (sessionClaims?.email as string) || "";
    const org = await ensureUserOrg(userId, email);

    const newLE = await prisma.clientLE.create({
        data: {
            name: data.name,
            jurisdiction: data.jurisdiction,
            status: "ACTIVE",
            clientOrgId: org.id, // Linked to Org, not User
        },
    });

    revalidatePath("/app/le");
    return { success: true, data: newLE };
}

// 3. Get Full Data (Schema + Answers) for an LE
export async function getClientLEData(leId: string) {
    const { userId } = await auth();
    if (!userId) return null;

    // 1. Get the LE
    console.log(`[getClientLEData] Fetching LE with ID: ${leId}`);
    const le = await prisma.clientLE.findFirst({
        where: { id: leId },
    });
    if (!le) return null;

    // 2. Get the Active Master Schema
    const activeSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true },
    });

    // 3. Get existing Answers (Records)
    // We want the LATEST record for this schema? Or just the latest answer wrapper?
    // The ERD says: ClientLERecord belongs to (ClientLE, MasterSchema).
    // Implementation: We find the record for this LE and this Schema.

    let record = null;
    if (activeSchema) {
        record = await prisma.clientLERecord.findFirst({
            where: {
                clientLEId: leId,
                masterSchemaId: activeSchema.id
            }
        });

        // Fallback: If no record for THIS version, find the most recent one for ANY version
        // This implements "Input Once": Answers carry forward to new schema versions automatically.
        if (!record) {
            record = await prisma.clientLERecord.findFirst({
                where: { clientLEId: leId },
                orderBy: { updatedAt: 'desc' }
            });
        }
    }

    return {
        le,
        schema: activeSchema,
        record
    };
}

// 4. Save Answers
export async function saveClientLEData(leId: string, schemaId: string, answers: any) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    // Upsert the record
    // We search by ID if we knew it, but here we search by composite (Client + Schema)
    // Prisma upsert needs a unique compound key. 
    // Let's check if we have a unique constraint on [clientLEId, schemaId].
    // If not, we do findFirst -> update/create.

    const existing = await prisma.clientLERecord.findFirst({
        where: { clientLEId: leId, masterSchemaId: schemaId }
    });

    if (existing) {
        await prisma.clientLERecord.update({
            where: { id: existing.id },
            data: {
                data: answers,
                // version: { increment: 1 }, // Removed version increment as it matches schema better for now or just simplicity
                // lastUpdatedBy: userId, 
            }
        });
    } else {
        await prisma.clientLERecord.create({
            data: {
                clientLEId: leId,
                masterSchemaId: schemaId,
                data: answers,
                status: "DRAFT",
            }
        });
    }

    revalidatePath(`/app/le/${leId}`);
    return { success: true };
}
