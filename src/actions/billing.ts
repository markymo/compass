
"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

// Helper for Auth
async function ensureAuthorization(action: Action, context: { partyId?: string, clientLEId?: string }) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error("Unauthorized: No User");

    const memberships = await prisma.membership.findMany({
        where: { userId: identity.userId },
        select: {
            organizationId: true,
            clientLEId: true,
            fiEngagementId: true,
            role: true,
            clientLE: {
                select: {
                    isDeleted: true,
                    status: true,
                }
            }
        }
    });

    const user: UserWithMemberships = {
        id: identity.userId,
        memberships: memberships
    };

    const allowed = await can(user, action, context, prisma);
    if (!allowed) throw new Error(`Unauthorized: Cannot perform ${action}`);

    return { userId: identity.userId };
}

// 1. Get Billing Data (All LEs in an Org)
export async function getClientBillingData(clientId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    try {
        // PERMISSION CHECK:
        // We need to check if the user is authorized to SEE the Org Management area or at least LE data.
        // For now, let's assume if they are an Org Member they can see "some" LEs billing?
        // But the requirement implies full management list.
        // Let's reuse basic Org Admin check for "Management" or "LE Admin" view.

        // Let's resolve the user's role in this Org explicitly.
        const membership = await prisma.membership.findFirst({
            where: {
                userId: identity.userId,
                organizationId: clientId,
                clientLEId: null
            },
            include: { organization: true }
        });

        // Determine effective role
        let isOrgAdmin = false;
        if (membership) {
            isOrgAdmin = membership.role === "ORG_ADMIN";
        }

        // If not explicit Org Admin, are they System Admin?
        // (We can assume ensureUserOrg handles system admin implications but let's be strict).

        // If they are not Org Admin, do they have LE Admin rights? (For Read Only)
        // We will fetch ALL LEs, but maybe filter?
        // User said: "LE Admin can see a version...". 
        // So we should return all LEs, but maybe flag permission per LE?

        // Let's just fetch all LEs belonging to the Org, and let the UI handle editability.
        // But we must secure the output.
        // If I am NOT an Org Admin, and NOT a System Admin, I should only see LEs I am a member of?

        // Actually, let's keep it simple: Access to this page requires strict auth.
        // We'll rely on fetching LEs where the user has *some* access or is Org Admin.

        const org = await prisma.organization.findUnique({ where: { id: clientId } });
        if (!org) return { success: false, error: "Not Found" };

        let clientLEs = [];

        if (isOrgAdmin) {
            // Fetch ALL active/archived LEs for this Client Org
            clientLEs = await prisma.clientLE.findMany({
                where: {
                    owners: { some: { partyId: clientId, endAt: null } },
                    isDeleted: false,
                },
                orderBy: { name: 'asc' }
            });
        } else {
            // Only fetch LEs where the user is a member
            clientLEs = await prisma.clientLE.findMany({
                where: {
                    owners: { some: { partyId: clientId, endAt: null } },
                    isDeleted: false,
                    memberships: { some: { userId: identity.userId } }
                },
                orderBy: { name: 'asc' }
            });
        }

        // Map to include a 'canEdit' flag per LE
        // Using ORG_ADMIN logic: Only Org Admins can update billing details.
        const data = clientLEs.map((le: any) => ({
            id: le.id,
            name: le.name,
            jurisdiction: le.jurisdiction,
            billingDetails: le.billingDetails || {},
            canEdit: isOrgAdmin
        }));

        return {
            success: true,
            data: {
                orgName: org.name,
                les: data,
                isOrgAdmin
            }
        };

    } catch (e) {
        console.error("Fetch Billing Failed", e);
        return { success: false, error: "Failed to load billing data." };
    }
}

// 2. Update Billing Details
export async function updateLEBilling(leId: string, data: any) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };

    // 1. Resolve active owner Organization for this Legal Entity
    const leOwner = await prisma.clientLEOwner.findFirst({
        where: { clientLEId: leId, endAt: null },
        include: { clientLE: { select: { isDeleted: true } } }
    });

    if (!leOwner || (leOwner.clientLE && leOwner.clientLE.isDeleted)) {
        return { success: false, error: "Legal Entity not found or has no active owner." };
    }

    // 2. Authorize using organization-level billing action scoped to the owning party
    try {
        await ensureAuthorization(Action.ORG_MANAGE_BILLING, { partyId: leOwner.partyId });
    } catch (e) {
        return { success: false, error: "Unauthorized: You do not have permission to edit billing details." };
    }

    // 3. Persist billing updates
    try {
        await prisma.clientLE.update({
            where: { id: leId },
            data: {
                billingDetails: data
            }
        });

        revalidatePath(`/app/clients/${leOwner.partyId}/billing`);
        return { success: true };
    } catch (e) {
        return { success: false, error: "Update failed" };
    }
}
