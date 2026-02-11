
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
            role: true
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
        // Ideally we check action LE_UPDATE (or specifically LE_MANAGE_BILLING if we had it).
        // Using LE_UPDATE logic: Org Admins can update.
        // LE Admins: The prompt says "cannot edit".
        // So canEdit = isOrgAdmin.

        const data = clientLEs.map(le => ({
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
    // Strict Check: Must be Org Admin (or System Admin)
    // We check against the LE's owner Org.

    // We can use permissions system: ORG_ADMIN has LE_UPDATE. 
    // Is editing billing covers by LE_UPDATE? Yes.
    // Does LE_ADMIN have LE_UPDATE? NO. (Check permissions.ts: LE_ADMIN has LE_VIEW_DATA, LE_EDIT_DATA, users... not LE_UPDATE).

    // permissions.ts:
    // LE_UPDATE (Rename/Move): ORG_ADMIN only.
    // LE_EDIT_DATA (Upload docs/answers): LE_ADMIN & LE_USER.

    // The requirement says: "LE Admin... cannot edit it". 
    // So ensuring LE_UPDATE action is the correct restriction.

    try {
        await ensureAuthorization(Action.LE_UPDATE, { clientLEId: leId });
    } catch (e) {
        return { success: false, error: "Unauthorized: You do not have permission to edit billing details." };
    }

    try {
        await prisma.clientLE.update({
            where: { id: leId },
            data: {
                billingDetails: data
            }
        });

        // Revalidate the billing page
        // We don't know the exact org ID path here easily, but we can try generic
        // Or revalidate the LE page?
        revalidatePath(`/app/clients/[id]/billing`);

        return { success: true };
    } catch (e) {
        return { success: false, error: "Update failed" };
    }
}
