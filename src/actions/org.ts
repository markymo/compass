"use server";

import prisma from "@/lib/prisma";
import { isSystemAdmin } from "./admin";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from 'uuid';

// 1. Create Organization (Admin Only)
export async function createOrganization(name: string, types: ("CLIENT" | "FI" | "SYSTEM" | "LAW_FIRM" | "SUPPLIER" | "OTHER")[]) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    // Enforce invariant: FI, LAW_FIRM, and OTHER are all subtypes of SUPPLIER.
    // Auto-add SUPPLIER if any of those are present so queries on `has: "SUPPLIER"` work correctly.
    const finalTypes = [...types];
    const SUPPLIER_SUBTYPES = ["FI", "LAW_FIRM", "OTHER"] as const;
    if (SUPPLIER_SUBTYPES.some(s => finalTypes.includes(s)) && !finalTypes.includes("SUPPLIER")) {
        finalTypes.push("SUPPLIER");
    }

    try {
        const org = await prisma.organization.create({
            data: {
                name,
                types: finalTypes as any,
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
                select: {
                    memberships: true,
                    ownedLEs: true,
                    engagements: true,
                    questionnaires: true,
                    ownedQuestionnaires: true,
                    customFieldDefinitions: true,
                    fiSchemas: true,
                    invitations: true,
                    ownedClaims: true,
                    claims: true,
                    referencedInClaims: true,
                    visibilityGrants: true,
                }
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
            // Include related entities
            ownedLEs: {
                where: { endAt: null },
                include: {
                    clientLE: {
                        include: { legalEntity: true }
                    }
                }
            },
            engagements: {
                select: {
                    id: true,
                    status: true,
                    dueDate: true,
                    clientLE: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }
        }
    });
}

// 4. Add Member to Organization (Admin Only)
export async function addMemberToOrg(orgId: string, email: string, role: "ORG_ADMIN" | "ORG_MEMBER" = "ORG_MEMBER") {
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

// 5. Update Organization (Admin Only)
export async function updateOrganization(orgId: string, data: { name?: string, status?: string, shortCode?: string | null, domain?: string | null }) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const org = await prisma.organization.update({
            where: { id: orgId },
            data: {
                name: data.name,
                status: data.status,
                ...(data.shortCode !== undefined && { shortCode: data.shortCode }),
                ...(data.domain !== undefined && { domain: data.domain }),
            }
        });
        revalidatePath(`/app/admin/organizations/${orgId}`);
        revalidatePath("/app/admin/organizations");
        revalidatePath("/app/admin/questionnaires");
        return { success: true, data: org };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to update organization" };
    }
}

// 5b. Update Short Code Only (Admin Only) - with validation
export async function updateOrgShortCode(orgId: string, shortCode: string | null) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    if (shortCode !== null) {
        const clean = shortCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (clean.length === 0) return { success: false, error: "Short code cannot be empty" };
        if (clean.length > 6) return { success: false, error: "Short code must be 6 characters or fewer" };
        try {
            const org = await prisma.organization.update({
                where: { id: orgId },
                data: { shortCode: clean }
            });
            revalidatePath(`/app/admin/organizations/${orgId}`);
            revalidatePath("/app/admin/questionnaires");
            return { success: true, data: org };
        } catch (e) {
            console.error(e);
            return { success: false, error: "Failed to update short code" };
        }
    } else {
        try {
            const org = await prisma.organization.update({
                where: { id: orgId },
                data: { shortCode: null }
            });
            revalidatePath(`/app/admin/organizations/${orgId}`);
            revalidatePath("/app/admin/questionnaires");
            return { success: true, data: org };
        } catch (e) {
            console.error(e);
            return { success: false, error: "Failed to clear short code" };
        }
    }
}
// 6. Archive Organization (Admin Only)
export async function archiveOrganization(orgId: string) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        // Archive the Org
        await prisma.organization.update({
            where: { id: orgId },
            data: { status: "ARCHIVED" }
        });

        // Optionally Archive all Owned LEs?
        // Let's cascade conceptually (frontend filtering) or explicitly?
        // Explicitly is safer for queries.
        // Find owned LEs
        const owned = await prisma.clientLEOwner.findMany({
            where: { partyId: orgId, endAt: null },
            include: { clientLE: true }
        });

        const leIds = owned.map((o: any) => o.clientLEId);

        if (leIds.length > 0) {
            await prisma.clientLE.updateMany({
                where: { id: { in: leIds } },
                data: { status: "ARCHIVED" }
            });
        }

        revalidatePath(`/app/admin/organizations/${orgId}`);
        revalidatePath("/app/admin/organizations");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to archive organization" };
    }
}

// 7. Unarchive Organization (Admin Only)
export async function unarchiveOrganization(orgId: string) {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        // Unarchive the Org
        await prisma.organization.update({
            where: { id: orgId },
            data: { status: "ACTIVE" }
        });

        // Unarchive all Owned LEs
        const owned = await prisma.clientLEOwner.findMany({
            where: { partyId: orgId, endAt: null },
            include: { clientLE: true }
        });

        const leIds = owned.map((o: any) => o.clientLEId);

        if (leIds.length > 0) {
            await prisma.clientLE.updateMany({
                where: { id: { in: leIds } },
                data: { status: "ACTIVE" }
            });
        }

        revalidatePath(`/app/admin/organizations/${orgId}`);
        revalidatePath("/app/admin/organizations");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to unarchive organization" };
    }
}

// 8a. Check if Organization can be safely deleted (Admin Only)
//
// Read-only check — does NOT delete. Checks ALL Prisma relations.
export async function checkOrgDeletable(orgId: string): Promise<{
    deletable: boolean;
    error?: string;
    blockers?: string[];
}> {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { deletable: false, error: "Unauthorized" };

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return { deletable: false, error: "Organization not found" };

    const blockers = await getOrgBlockers(orgId);

    if (blockers.length > 0) {
        return {
            deletable: false,
            error: `Cannot delete: org has ${blockers.join(', ')}`,
            blockers,
        };
    }

    return { deletable: true };
}

// 8b. Delete Organization (Admin Only) — with exhaustive safety re-check
export async function deleteOrganization(orgId: string): Promise<{
    success: boolean;
    error?: string;
    blockers?: string[];
}> {
    const isAdmin = await isSystemAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return { success: false, error: "Organization not found" };

    // Re-check safety at delete time (race-condition guard)
    const blockers = await getOrgBlockers(orgId);
    if (blockers.length > 0) {
        return {
            success: false,
            error: `Cannot delete: org has ${blockers.join(', ')}`,
            blockers,
        };
    }

    try {
        await prisma.organization.delete({ where: { id: orgId } });
        revalidatePath("/app/admin/organizations");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Failed to delete organization" };
    }
}

// ── Shared helper: exhaustive relation check ─────────────────────────────────
// Every Organization relation in the Prisma schema must be covered here.
// If ANY count is > 0, the org is NOT safe to hard-delete.

async function getOrgBlockers(orgId: string): Promise<string[]> {
    const [
        memberships,
        ownedLEs,
        engagements,
        questionnaires,
        ownedQuestionnaires,
        customFieldDefinitions,
        fiSchemas,
        invitations,
        ownedClaims,
        claims,
        referencedInClaims,
        visibilityGrants,
    ] = await Promise.all([
        prisma.membership.count({ where: { organizationId: orgId } }),
        prisma.clientLEOwner.count({ where: { partyId: orgId } }),
        prisma.fIEngagement.count({ where: { fiOrgId: orgId } }),
        prisma.questionnaire.count({ where: { fiOrgId: orgId } }),
        prisma.questionnaire.count({ where: { ownerOrgId: orgId } }),
        prisma.customFieldDefinition.count({ where: { orgId: orgId, isDeleted: false } }),
        prisma.fISchema.count({ where: { fiOrgId: orgId } }),
        prisma.invitation.count({ where: { organizationId: orgId } }),
        prisma.fieldClaim.count({ where: { ownerScopeId: orgId } }),
        prisma.fieldClaim.count({ where: { subjectOrgId: orgId } }),
        prisma.fieldClaim.count({ where: { valueOrgId: orgId } }),
        prisma.questionnaireVisibilityGrant.count({ where: { organizationId: orgId } }),
    ]);

    const blockers: string[] = [];
    if (memberships > 0)            blockers.push(`${memberships} member${memberships !== 1 ? 's' : ''}`);
    if (ownedLEs > 0)               blockers.push(`${ownedLEs} owned legal entit${ownedLEs !== 1 ? 'ies' : 'y'}`);
    if (engagements > 0)            blockers.push(`${engagements} engagement${engagements !== 1 ? 's' : ''}`);
    if (questionnaires > 0)         blockers.push(`${questionnaires} questionnaire${questionnaires !== 1 ? 's' : ''}`);
    if (ownedQuestionnaires > 0)    blockers.push(`${ownedQuestionnaires} owned questionnaire${ownedQuestionnaires !== 1 ? 's' : ''}`);
    if (customFieldDefinitions > 0) blockers.push(`${customFieldDefinitions} custom field${customFieldDefinitions !== 1 ? 's' : ''}`);
    if (fiSchemas > 0)              blockers.push(`${fiSchemas} schema${fiSchemas !== 1 ? 's' : ''}`);
    if (invitations > 0)            blockers.push(`${invitations} invitation${invitations !== 1 ? 's' : ''}`);
    if (ownedClaims > 0)            blockers.push(`${ownedClaims} owned claim${ownedClaims !== 1 ? 's' : ''}`);
    if (claims > 0)                 blockers.push(`${claims} subject claim${claims !== 1 ? 's' : ''}`);
    if (referencedInClaims > 0)     blockers.push(`${referencedInClaims} referenced claim${referencedInClaims !== 1 ? 's' : ''}`);
    if (visibilityGrants > 0)       blockers.push(`${visibilityGrants} visibility grant${visibilityGrants !== 1 ? 's' : ''}`);

    return blockers;
}
