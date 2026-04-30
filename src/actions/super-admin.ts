"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./admin"; // Re-use existing check
import { revalidatePath } from "next/cache";

// 1. Get System Stats
export async function getSystemStats() {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return null;

    const [clientCount, leCount, userCount, fiCount, lawFirmCount] = await Promise.all([
        prisma.organization.count({ where: { types: { has: "CLIENT" } } }),
        prisma.clientLE.count(),
        prisma.user.count(),
        prisma.organization.count({ where: { types: { has: "FI" } } }),
        prisma.organization.count({ where: { types: { has: "LAW_FIRM" as any } } }),
    ]);

    return {
        clientCount,
        leCount,
        userCount,
        fiCount,
        lawFirmCount
    };
}

// 2. Onboard Client Wizard Action
export async function onboardClient(data: { name: string, adminEmail: string }) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const { name, adminEmail } = data;

    try {
        // A. Create Organization
        const org = await prisma.organization.create({
            data: {
                name,
                types: ["CLIENT"]
            }
        });

        // B. Find or Create User
        let user = await prisma.user.findFirst({
            where: { email: adminEmail }
        });

        if (!user) {
            const { v4: uuidv4 } = require('uuid');
            user = await prisma.user.create({
                data: {
                    id: `invite_${uuidv4()}`,
                    email: adminEmail
                }
            });
        }

        // C. Assign Admin Role
        await prisma.membership.create({
            data: {
                userId: user.id,
                organizationId: org.id,
                role: "ORG_ADMIN"
            }
        });

        revalidatePath("/app/admin/super");
        return { success: true, orgId: org.id };

    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to onboard client" };
    }
}

// 3. Purge Client LE (Hard Delete)
export async function purgeClientLE(clientLEId: string) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        // 1. Fetch ClientLE and its primary owner to resolve the scoping Organization
        const le = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            include: {
                owners: { where: { endAt: null }, take: 1 }
            }
        });

        if (!le) return { success: false, error: "Legal Entity Workspace not found" };

        const subjectLeId = le.legalEntityId;
        const ownerScopeId = le.owners[0]?.partyId;

        // 2. Atomic Cleanup in Transaction
        await prisma.$transaction([
            // A. Delete FieldClaims (Master Data) asserted specifically by this client for this LE
            ...(subjectLeId && ownerScopeId ? [
                prisma.fieldClaim.deleteMany({
                    where: {
                        subjectLeId: subjectLeId,
                        ownerScopeId: ownerScopeId
                    }
                })
            ] : []),

            // B. Delete the ClientLE itself. 
            // Cascading deletes in schema.prisma will handle:
            // - FIEngagement -> Questionnaire Instances -> Questions -> Comments/Activity
            // - Document
            // - Membership
            // - ClientLERecord
            // - ClientLEGraphNode / Edge
            // - RegistryReference -> RegistryFetch
            // - EnrichmentRun -> Payload/Baseline
            // - ClientLEOwner
            prisma.clientLE.delete({
                where: { id: clientLEId }
            })
        ]);

        console.log(`[SuperAdmin] Successfully purged ClientLE: ${le.name} (${clientLEId})`);
        revalidatePath("/app/admin/users"); // If called from users dashboard
        revalidatePath("/app/admin/super");
        return { success: true };

    } catch (e) {
        console.error("[SuperAdmin] Purge Failed:", e);
        return { success: false, error: "Failed to purge Legal Entity data. Check server logs." };
    }
}
