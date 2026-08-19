"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";

import { cookies } from "next/headers";
import {
    emptyMetrics,
    calculateEngagementMetrics,
    calculateEngagementOwnMetrics,
    calculateEffectiveEngagementMetrics,
    calculateCommonQuestionnaireMetrics,
    rollupMetrics,
    DashboardMetric,
    calculateQuestionnaireMetrics
} from "@/lib/metrics-calc";
import { LegalEntityEnrichmentService } from "@/domain/registry";
import { getLEDisplayName } from "@/lib/le-display-name";

// --- Authorization Helper ---
async function ensureAuthorization(action: Action, context: { partyId?: string, clientLEId?: string, engagementId?: string }) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error("Unauthorized: No User");
    const { userId } = identity;

    // Fetch User with Memberships (reusing simple fetch for now, similar to ensureUserOrg but raw)
    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: {
            organizationId: true,
            clientLEId: true,
            role: true
        }
    });

    const user: UserWithMemberships = {
        id: userId,
        memberships: memberships
    };

    const allowed = await can(user, action, context, prisma);
    if (!allowed) throw new Error(`Unauthorized: Cannot perform ${action}`);

    return { userId, user };
}

// Helper to get or create the user's Client Organization
export async function ensureUserOrg(userId: string, userEmail: string = "") {
    // 0. Fallback: If email is missing, we rely on what was passed or DB.
    // Clerk fallback removed.
    if (!userEmail) {
        // We could fetch from DB if needed, but usually getIdentity provides it.
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

    // 2. Fetch all memberships (Party Scope)
    const memberships = await prisma.membership.findMany({
        where: { userId, organizationId: { not: null } },
        include: { organization: true }
    });

    if (memberships.length > 0) {
        // Priority 0: Check Cookie for Preference
        const cookieStore = await cookies();
        const preferredOrgId = cookieStore.get("compass_active_org")?.value;

        if (preferredOrgId) {
            const preferredMembership = memberships.find((m: any) => m.organization?.id === preferredOrgId);
            if (preferredMembership && preferredMembership.organization) {
                return preferredMembership.organization;
            }
        }

        // Priority 1: System Admin
        const systemMembership = memberships.find((m: any) => m.organization?.types.includes("SYSTEM"));
        if (systemMembership && systemMembership.organization) return systemMembership.organization;

        // Priority 2: Any other (e.g. Client)
        // Ensure organization is not null (Prisma typing)
        const validOrg = memberships[0].organization;
        if (validOrg) return validOrg;
    }

    // 3. If not, AUTO-CREATE or LINK (for this demo/v1)
    console.log(`[ensureUserOrg] No memberships found for ${userId}. Checking for pending invitations...`);

    // Check if a placeholder user exists with this email
    if (userEmail && userEmail !== "unknown@demo.com") {
        const existingUserByEmail = await prisma.user.findFirst({
            where: { email: userEmail }
        });

        if (existingUserByEmail && existingUserByEmail.id !== userId) {
            console.log(`[ensureUserOrg] Found placeholder user ${existingUserByEmail.id} for ${userEmail}. Merging...`);

            try {
                await prisma.$transaction(async (tx: any) => {
                    // 0. Free up the email on the placeholder so we can assign it to the new user ID
                    await tx.user.update({
                        where: { id: existingUserByEmail.id },
                        data: { email: `${existingUserByEmail.id}@merged.demo.com` }
                    });

                    // 1. Create New User first to satisfy foreign keys
                    // We use upsert in case the userId is already in the DB from a concurrent request.
                    await tx.user.upsert({
                        where: { id: userId },
                        update: { email: userEmail, name: existingUserByEmail.name },
                        create: { id: userId, email: userEmail, name: existingUserByEmail.name }
                    });

                    // 2. Move Memberships
                    await tx.membership.updateMany({
                        where: { userId: existingUserByEmail.id },
                        data: { userId: userId }
                    });

                    // 3. Move Comments/Activities/Todos/Notes if any
                    await tx.comment.updateMany({ where: { userId: existingUserByEmail.id }, data: { userId: userId } });
                    await tx.questionActivity.updateMany({ where: { userId: existingUserByEmail.id }, data: { userId: userId } });
                    await tx.masterFieldNote.updateMany({ where: { createdByUserId: existingUserByEmail.id }, data: { createdByUserId: userId } });
                    await tx.privateDocumentUploadIntent.updateMany({ where: { initiatedById: existingUserByEmail.id }, data: { initiatedById: userId } });

                    // 4. Delete Placeholder
                    await tx.user.delete({
                        where: { id: existingUserByEmail.id }
                    });
                });
                console.log(`[ensureUserOrg] Merge complete. Welcome ${userEmail}`);
            } catch (error: any) {
                if (error.code === 'P2025') {
                    console.log(`[ensureUserOrg] Placeholder ${existingUserByEmail.id} was already merged concurrently.`);
                } else {
                    throw error;
                }
            }
            // Return early or let flow continue to fetch memberships again?
            // Fetching memberships again is safest.
            // Fetching memberships again is safest.
            const mergedMemberships = await prisma.membership.findMany({
                where: { userId, organizationId: { not: null } },
                include: { organization: true }
            });
            // if (mergedMemberships.length > 0) return mergedMemberships[0].organization; // Removing return
        }
    }

    // Ensure User exists (Atomic upsert to handle concurrent requests)
    await prisma.user.upsert({
        where: { id: userId },
        update: {
            // Update email if we have a better one than the placeholder or current
            ...(userEmail && userEmail !== "unknown@demo.com" ? { email: userEmail } : {})
        },
        create: {
            id: userId,
            email: userEmail || "unknown@demo.com"
        }
    });

    // Removed auto-creation of personal organizations for new users.
    // They will now land on an empty dashboard state until invited to an organization.
}



// Check if user has ANY system admin membership (regardless of active context)
export async function checkIsSystemAdmin(userId: string) {
    const membership = await prisma.membership.findFirst({
        where: {
            userId,
            organization: { types: { has: "SYSTEM" } }
        }
    });
    return !!membership;
}

export async function getUserOrganizations() {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    const memberships = await prisma.membership.findMany({
        where: { userId, organizationId: { not: null } },
        include: { organization: true }
    });

    // Deduplicate and filter nulls
    const uniqueOrgs = new Map();
    memberships.forEach((m: any) => {
        if (m.organization) {
            uniqueOrgs.set(m.organization.id, m.organization);
        }
    });

    return Array.from(uniqueOrgs.values());
}

// 1. Get List of Client LEs with Dashboard Data
export async function getClientLEs(explicitOrgId?: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId, email } = identity;

    // Ensure user record exists (and email is synced)
    await ensureUserOrg(userId, email || "");

    // 1. Get all organizations where user is a MEMBER or ADMIN
    const memberships = await prisma.membership.findMany({
        where: { userId, organizationId: { not: null } },
        select: { organizationId: true }
    });

    // Filter to Client Orgs if needed? 
    // Actually, we want CLIENT LEs. Client LEs belong to Client Orgs.
    // If I am a member of Org X, I should see Org X's LEs.

    const myOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean) as string[];

    if (myOrgIds.length === 0) return [];

    // 2. Fetch all LEs belonging to these Orgs
    // 2. Fetch all LEs belonging to these Orgs OR where I am a direct member
    const whereClause: any = {
        isDeleted: false,
        status: { not: "ARCHIVED" }
    };

    if (explicitOrgId) {
        // Strict Mode: Must be owned by Target Org AND (I am Org Member OR I am LE Member)
        const isOrgMember = myOrgIds.includes(explicitOrgId);

        whereClause.owners = { some: { partyId: explicitOrgId, endAt: null } };

        if (!isOrgMember) {
            // I am NOT a member of the Org, so I can only see LEs where I am a direct member
            whereClause.memberships = { some: { userId } };
        }
    } else {
        // Global Mode: Owned by any of My Orgs OR I am a direct member
        whereClause.OR = [
            { owners: { some: { partyId: { in: myOrgIds }, endAt: null } } },
            { memberships: { some: { userId } } }
        ];
    }

    return await prisma.clientLE.findMany({
        where: whereClause,
        include: {
            // Fetch engagements to show which banks they are working with
            fiEngagements: {
                where: { isDeleted: false },
                include: {
                    org: true, // The Bank Name
                    questionnaires: {
                        where: { isDeleted: false }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Determines whether a ClientLE record is a CURRENT operational dossier.
 * - CURRENT: isDeleted === false AND status !== "ARCHIVED" (e.g. ACTIVE, SUSPENDED).
 * - NON-CURRENT: isDeleted === true OR status === "ARCHIVED".
 */
export async function isCurrentClientLEDossier(cle: { isDeleted: boolean; status?: string | null }): Promise<boolean> {
    if (cle.isDeleted) return false;
    if (cle.status && cle.status.toUpperCase() === "ARCHIVED") return false;
    return true;
}

/**
 * Centralized domain helper: Finds any CURRENT operational ClientLE dossier for a given Client Organisation + LegalEntity (or LEI).
 * Scoped strictly to the specified clientOrgId.
 */
export async function findCurrentClientLEDossier(params: {
    clientOrgId: string;
    legalEntityId?: string | null;
    lei?: string | null;
    excludingClientLEId?: string;
    dbClient?: any;
}) {
    const { clientOrgId, legalEntityId, lei, excludingClientLEId, dbClient } = params;
    if (!legalEntityId && !lei) return null;
    const client = dbClient || prisma;

    const whereOr: any[] = [];
    if (legalEntityId) whereOr.push({ legalEntityId });
    if (lei) whereOr.push({ lei });

    const clientLEs = await client.clientLE.findMany({
        where: {
            id: excludingClientLEId ? { not: excludingClientLEId } : undefined,
            isDeleted: false,
            status: { not: "ARCHIVED" },
            OR: whereOr,
            owners: {
                some: {
                    partyId: clientOrgId,
                    endAt: null
                }
            }
        },
        select: {
            id: true,
            name: true,
            status: true,
            isDeleted: true,
            legalEntityId: true,
            lei: true
        }
    });

    return clientLEs.length > 0 ? clientLEs[0] : null;
}

// 2. Create a new LE
export async function createClientLE(data: { name: string; jurisdiction: string; explicitOrgId?: string; lei?: string; gleifData?: any }) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    let targetOrgId = data.explicitOrgId;

    // If valid targetOrgId is not resolved, try to resolve a default
    if (!targetOrgId) {
        // Fetch all client memberships where user is ADMIN
        const adminMemberships = await prisma.membership.findMany({
            where: {
                userId,
                role: "ORG_ADMIN",
                organization: { types: { has: "CLIENT" } }
            },
            select: { organizationId: true }
        });

        if (adminMemberships.length === 1 && adminMemberships[0].organizationId) {
            targetOrgId = adminMemberships[0].organizationId;
        } else {
            // If System Admin, they have permission but we don't know which org to use.
            // If Client Admin of multiple, same issue.
            // We should check if they can AT LEAST one, if so, return Ambiguous.
            // If none, return Unauthorized.

            // Re-using the logic: if we found 0 admin memberships, we returned error above.
            // If we are here, we have 0 admin memberships (client scope) found by that query, OR multiple.

            // Let's rely on standard authorization check to differentiate.
            try {
                // Determine if they are a System Admin
                const isSys = await checkIsSystemAdmin(userId);
                if (isSys) {
                    return { success: false, error: "System Admin: Please select a specific Organization to create this entity for." };
                }

                // If not system admin, and we found 0 client admin memberships:
                if (adminMemberships.length === 0) {
                    return { success: false, error: "You do not have permission to create Legal Entities (No Client Admin role)." };
                }

                return { success: false, error: "Multiple Organizations detected: Please select which Organization to create this entity for." };
            } catch (e) {
                return { success: false, error: "Unauthorized." };
            }
        }
    } else {
        // Explicit Org provided. Check Permission.
    } // Close else block

    // New Standardized Check
    try {
        await ensureAuthorization(Action.LE_CREATE, { partyId: targetOrgId });
    } catch (e) {
        return { success: false, error: "Unauthorized: You do not have permission to create Legal Entities for this Organization." };
    }

    // --- 1. Shared LegalEntity linkage & Per-Client CURRENT dossier duplicate check ---
    let legalEntityId: string | undefined = undefined;
    if (data.lei) {
        let legalEntity = await prisma.legalEntity.findFirst({
            where: { reference: data.lei }
        });
        if (!legalEntity) {
            try {
                legalEntity = await prisma.legalEntity.create({
                    data: {
                        reference: data.lei,
                        name: data.name,
                        jurisdiction: data.jurisdiction
                    }
                });
            } catch (e) {
                legalEntity = await prisma.legalEntity.findFirst({
                    where: { reference: data.lei }
                });
            }
        }
        legalEntityId = legalEntity?.id;
    }

    const creationResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Transactional Advisory Lock: prevents concurrent duplicate creation races for same Org + LE
        const lockKey = `client_le_create:${targetOrgId}:${legalEntityId || data.lei || data.name}`;
        try {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        } catch (e) {
            // Ignore fallback for non-PostgreSQL mock environments
        }

        // Enforce One-Current-Dossier rule:
        // Prevent creating multiple CURRENT operational dossiers for the SAME LegalEntity within the SAME Client Organisation.
        const existingCurrent = await findCurrentClientLEDossier({
            clientOrgId: targetOrgId!,
            legalEntityId,
            lei: data.lei,
            dbClient: tx
        });

        if (existingCurrent) {
            return {
                success: false,
                error: `${data.name} already exists in your organisation.`
            };
        }

        // --- Proceed with valid creation ---
        // Extract National Registry Data if present in the GLEIF blob
        let gleifPayload = data.gleifData;
        let nationalPayload = null;
        if (gleifPayload && gleifPayload.nationalRegistryData) {
            nationalPayload = gleifPayload.nationalRegistryData;
            // Create a clean copy without our injected field
            const { nationalRegistryData, ...rest } = gleifPayload;
            gleifPayload = rest;
        }

        const newLE = await tx.clientLE.create({
            data: {
                name: data.name,
                jurisdiction: data.jurisdiction,
                lei: data.lei,
                dossierLabel: (data as any).dossierLabel || null,
                legalEntityId: legalEntityId || undefined,
                gleifData: gleifPayload,
                gleifFetchedAt: gleifPayload ? new Date() : null,
                nationalRegistryData: nationalPayload,
                registryFetchedAt: nationalPayload ? new Date() : null,
                status: "ACTIVE",
                owners: {
                    create: {
                        partyId: targetOrgId!,
                        startAt: new Date()
                    }
                }
            },
        });

        return { success: true, data: newLE };
    });

    if (!creationResult.success) {
        return creationResult;
    }

    const newLE = creationResult.data!;

    // Fire and forget (or await) the enrichment bootstrap
    try {
        await LegalEntityEnrichmentService.bootstrapEntity(newLE.id);
    } catch (e) {
        console.error("[createClientLE] Bootstrap failed (continuing anyway)", e);
    }

    revalidatePath("/app/le");
    revalidatePath("/app/clients/[clientId]");

    return { success: true, data: newLE };
}

// 3. Get Full Data (Schema + Answers) for an LE
export async function getClientLEData(leId: string) {
    // Check Auth - Wrap in try/catch to handle deleted/unauthorized gracefully
    if (!leId) return null;
    try {
        await ensureAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId: leId });
    } catch (e) {
        console.warn(`[getClientLEData] Access denied or entity missing for: ${leId}`);
        return null;
    }

    const identity = await getIdentity();
    if (!identity?.userId) return null;
    const { userId } = identity;

    // 1. Get the LE
    const le = await prisma.clientLE.findUnique({
        where: { id: leId },
        include: {
            owners: {
                where: { endAt: null },
                include: { party: true }
            },
            fiEngagements: {
                where: { isDeleted: false },
                include: {
                    org: true,
                    questionnaires: {
                        where: { isDeleted: false }
                    },
                    questionnaireInstances: {
                        where: { isDeleted: false }
                    },
                    _count: {
                        select: {
                            sharedDocuments: { where: { isDeleted: false } },
                            invitations: { where: { revokedAt: null, usedAt: null } },
                            memberships: true
                        }
                    }
                }
            },
            registryReferences: {
                include: { authority: true }
            },
            commonQuestionnaires: {
                where: { isDeleted: false }
            }
        }
    });

    if (!le) {
        console.error(`[getClientLEData] LE not found in DB: ${leId}`);
        return null;
    }

    const { calculateCommonQuestionnaireMetrics, calculateEngagementMetrics, calculateQuestionnaireMetrics } = await import("@/lib/metrics-calc");
    if (le.commonQuestionnaires) {
        for (const q of le.commonQuestionnaires) {
            (q as any).metrics = await calculateCommonQuestionnaireMetrics(q.id, le.id);
        }
    }

    for (const eng of le.fiEngagements) {
        // Compute engagement-level metrics
        (eng as any).metrics = await calculateEngagementMetrics(eng.id);

        // Combine both many-to-many and one-to-many relations for compatibility
        const combined = Array.from(
            new Map(
                [...(eng.questionnaireInstances || []), ...(eng.questionnaires || [])].map((q: any) => [q.id, q])
            ).values()
        );
        for (const q of combined) {
            (q as any).metrics = await calculateQuestionnaireMetrics((q as any).id);
        }
        (eng as any).questionnaires = combined;
        console.log(`[getClientLEData] Engagement ${eng.org.name} has ${(eng as any).questionnaires.length} ACTIVE questionnaires`);
    }

    // 2. Get the Active Master Schema
    const activeSchema = await prisma.masterSchema.findFirst({
        where: { isActive: true },
    });

    // 3. Get existing Answers (Records)
    let record = null;
    if (activeSchema) {
        record = await prisma.clientLERecord.findFirst({
            where: {
                clientLEId: leId,
                masterSchemaId: activeSchema.id
            }
        });

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
    try {
        await ensureAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId: leId });
    } catch (e) {
        return { success: false, error: "Unauthorized: Access denied." };
    }

    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

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

// 5. Update LE Basic Info (e.g. Description)
export async function updateClientLE(leId: string, data: { name?: string, description?: string, lei?: string, gleifData?: any }) {
    try {
        await ensureAuthorization(Action.LE_EDIT_MASTER_DATA, { clientLEId: leId });
    } catch (e) {
        return { success: false, error: "Unauthorized: Access denied." };
    }

    const identity = await getIdentity(); 
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    try {
        const updated = await prisma.clientLE.update({
            where: { id: leId },
            data: {
                name: data.name,
                description: data.description,
                ...(data.lei !== undefined && { lei: data.lei }),
                ...(data.gleifData !== undefined && {
                    gleifData: data.gleifData?.nationalRegistryData
                        ? (({ nationalRegistryData, ...rest }) => rest)(data.gleifData) // Exclude if present
                        : data.gleifData,
                    gleifFetchedAt: new Date(),
                    // Update National Data if present in the blob
                    ...(data.gleifData?.nationalRegistryData && {
                        nationalRegistryData: data.gleifData.nationalRegistryData,
                        registryFetchedAt: new Date()
                    })
                })
            }
        });
        console.log(`[updateClientLE] Update successful:`, JSON.stringify(updated, null, 2));

        // TRIGGER REGISTRY BOOTSTRAP on LEI/GLEIF data changes
        if (data.lei !== undefined || data.gleifData !== undefined) {
            console.log(`[updateClientLE] Triggering bootstrap for new LEI/GLEIF data for LE: ${leId}`);
            // We await it here so that by the time revalidatePath runs, the new references exist
            await LegalEntityEnrichmentService.bootstrapEntity(leId).catch(e => {
                console.error("[updateClientLE] Bootstrap error:", e);
            });
        }

        revalidatePath(`/app/le/${leId}`);
        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true };
    } catch (error) {
        console.error("[updateClientLE] Error:", error);
        return { success: false, error: "Failed to update legal entity" };
    }
}

// 6. Get Dashboard Metrics (Mission Control)
export async function getDashboardMetrics(leId: string) {
    try {
        await ensureAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId: leId });
    } catch (e) {
        return null;
    }

    const identity = await getIdentity();
    if (!identity?.userId) return null;
    const { userId } = identity;

    // A. Fetch Core Data
    const le = await prisma.clientLE.findUnique({
        where: { id: leId },
        include: {
            standingDataSections: true,
            commonQuestionnaires: {
                where: { isDeleted: false, isTemplate: false }
            },
            fiEngagements: {
                where: { isDeleted: false },
                include: {
                    org: true,
                    questionnaires: {
                        where: { isDeleted: false },
                        include: {
                            questions: true // Fetch individual questions for "Closing Tracker"
                        }
                    },
                    invitations: true,
                    activities: {
                        orderBy: { createdAt: 'asc' },
                        take: 1
                    }
                }
            }
        }
    });

    if (!le) return null;

    // B. Calculate Scores & CP Tracker
    const standingDataCount = le.standingDataSections.length;
    const standingDataScore = Math.min(standingDataCount, 5) / 5 * 60;

    // CP Tracker Buckets
    // Use the shared metric structure
    const leMetrics = emptyMetrics();

    // Roll up unique active Common Questionnaires ONCE to LE level
    if (le.commonQuestionnaires) {
        for (const cq of le.commonQuestionnaires) {
            const cqMetrics = await calculateCommonQuestionnaireMetrics(cq.id, leId);
            rollupMetrics(leMetrics, cqMetrics);
        }
    }

    const engagementStats = new Map<string, { total: number, answered: number }>();

    for (const eng of le.fiEngagements) {
        // Roll up relationship-own metrics ONCE to LE level
        const ownMetrics = await calculateEngagementOwnMetrics(eng.id);
        rollupMetrics(leMetrics, ownMetrics);

        // Effective metrics for supplier relationship view
        const effectiveMetrics = await calculateEffectiveEngagementMetrics(eng.id, leId);

        engagementStats.set(eng.id, { total: effectiveMetrics.total, answered: effectiveMetrics.answered });
    }

    const totalQuestions = leMetrics.total;
    const answeredQuestions = leMetrics.answered;

    const questionnaireScore = totalQuestions > 0
        ? (answeredQuestions / totalQuestions) * 40
        : 0;

    // Map back to 'cpStatus' for frontend compatibility
    const cpStatus = {
        draft: leMetrics.noData,
        internalReview: leMetrics.mapped,
        shared: leMetrics.released,
        done: leMetrics.approved
    };

    // C. Activity Feed (Team-wide, filtered by this LE)
    // 1. Get all users associated with this LE to map names
    // We already got some from memberships if we fetched them, but LE object doesn't have them all loaded in the findUnique above.
    // Let's fetch memberships for this LE to get user names.
    const memberships = await prisma.membership.findMany({
        where: { clientLEId: leId },
        include: { user: true }
    });

    // Create a map of UserId -> Name
    const userMap = new Map<string, string>();
    memberships.forEach((m: any) => {
        if (m.user) userMap.set(m.userId, m.user.name || m.user.email);
    });
    // Add current user to map if missing (e.g. Org Admin not explicit LE member)
    if (!userMap.has(userId) && identity) {
        userMap.set(userId, identity.email || "You");
    }

    // 2. Fetch Logs for this LE context
    // We filter by path containing the LE ID, which is a strong signal for LE-specific activity.
    const logs = await prisma.usageLog.findMany({
        where: {
            path: { contains: leId }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    return {
        readiness: {
            total: Math.round(standingDataScore + questionnaireScore),
            standingData: Math.round(standingDataScore),
            questionnaires: Math.round(questionnaireScore),
            details: {
                sectionsCompleted: standingDataCount,
                questionsAnswered: answeredQuestions,
                totalQuestions: totalQuestions,
                cpStatus // Return the buckets
            },
            metrics: leMetrics // New Standardized Metrics
        },
        pipeline: le.fiEngagements.map((e: any) => {
            // Find earliest invitation date
            const earliestInvite = e.invitations.length > 0
                ? e.invitations.reduce((min: any, inv: any) => inv.createdAt < min.createdAt ? inv : min, e.invitations[0])
                : null;

            // Find earliest accepted date (usedAt or accepted by user)
            const acceptedInvites = e.invitations.filter((i: any) => i.usedAt !== null || i.acceptedByUserId !== null);
            const earliestAccepted = acceptedInvites.length > 0
                ? acceptedInvites.reduce((min: any, inv: any) => {
                    const minDate = min.usedAt || min.updatedAt;
                    const invDate = inv.usedAt || inv.updatedAt;
                    return invDate < minDate ? inv : min;
                }, acceptedInvites[0])
                : null;

            return {
                id: e.id,
                fiName: e.org.name,
                status: e.status,
                stats: engagementStats.get(e.id) || { total: 0, answered: 0 },
                isInvited: e.invitations.length > 0,
                isAccepted: acceptedInvites.length > 0,
                addedDate: e.activities[0]?.createdAt || null,
                invitedDate: earliestInvite?.createdAt || null,
                acceptedDate: earliestAccepted ? (earliestAccepted.usedAt || earliestAccepted.updatedAt) : null
            };
        }),
        activity: logs.map((l: any) => ({
            id: l.id,
            action: l.action,
            time: l.createdAt,
            user: (l.userId === userId ? "You" : userMap.get(l.userId)) || "Unknown User"
        }))
    };
}
/**
 * Canonical core restore logic for ClientLE, its FIEngagements, and linked Questionnaires.
 * Restores existing soft-deleted record without creating a new record or modifying master data/history.
 * Soft delete changes only deletion state. Restore reverses deletion state and does not silently rewrite operational status.
 */
export async function restoreClientLECore(clientLEId: string) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 0. Load target ClientLE to inspect legal entity and owner organizations
        const targetLE = await tx.clientLE.findUnique({
            where: { id: clientLEId },
            include: {
                owners: {
                    where: { endAt: null },
                    select: { partyId: true }
                }
            }
        });

        if (!targetLE) {
            throw new Error("ClientLE not found.");
        }

        // Enforce One-Current-Dossier rule:
        // If restoring will make this dossier CURRENT (status != "ARCHIVED"), block restore if another CURRENT operational dossier exists.
        if (targetLE.status !== "ARCHIVED") {
            for (const owner of targetLE.owners) {
                const lockKey = `client_le_create:${owner.partyId}:${targetLE.legalEntityId || targetLE.lei || targetLE.name}`;
                try {
                    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
                } catch (e) {
                    // Ignore for non-PostgreSQL mock environments
                }

                const existingCurrent = await findCurrentClientLEDossier({
                    clientOrgId: owner.partyId,
                    legalEntityId: targetLE.legalEntityId || undefined,
                    lei: targetLE.lei || undefined,
                    excludingClientLEId: clientLEId,
                    dbClient: tx
                });

                if (existingCurrent) {
                    throw new Error(
                        `Cannot restore this dossier because ${targetLE.name} already has a current dossier for this Client Organisation. The current dossier must be deleted or archived before restoring this record.`
                    );
                }
            }
        }

        // 1. Un-delete the LE while preserving its operational status (ACTIVE, SUSPENDED, or ARCHIVED)
        const updatedLE = await tx.clientLE.update({
            where: { id: clientLEId },
            data: { isDeleted: false }
        });

        // 2. Un-delete Engagements & Questionnaires for this LE
        await tx.fIEngagement.updateMany({
            where: { clientLEId: clientLEId },
            data: { isDeleted: false }
        });

        const restoredEngs = await tx.fIEngagement.findMany({
            where: { clientLEId: clientLEId },
            select: { id: true }
        });
        const restoredEngIds = restoredEngs.map((e: any) => e.id);

        if (restoredEngIds.length > 0) {
            await tx.questionnaire.updateMany({
                where: { fiEngagementId: { in: restoredEngIds } },
                data: { isDeleted: false }
            });
        }

        return updatedLE;
    });
}

// 7. Archive / Delete Client LE
export async function deleteClientLE(leId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;
    // Ownership check is implicit in getClientLEs but for write we should double check OR assume they can only edit what they see.
    // Ideally we check ownership via ensureUserOrg.

    // We need to find the LE first to check ownership
    const le = await prisma.clientLE.findUnique({
        where: { id: leId },
        select: { id: true }
    });
    if (!le) return { success: false, error: "Legal Entity not found" };

    // Standardized Check
    // For delete, we check LE_ARCHIVE (as we are soft deleting)
    try {
        await ensureAuthorization(Action.LE_ARCHIVE, { clientLEId: leId });
    } catch (e) {
        return { success: false, error: "Unauthorized: You do not have permission to delete this Legal Entity." };
    }

    try {
        // Cascade: Delete LE -> Delete Engagements -> Delete Questionnaire Instances
        // 1. Find all engagements
        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId: leId }
        });
        const engagementIds = engagements.map((e: any) => e.id);

        // 2. Soft Delete all Questionnaires linked to these engagements
        await prisma.questionnaire.updateMany({
            where: { fiEngagementId: { in: engagementIds } },
            data: { isDeleted: true }
        });

        // 3. Soft Delete all Engagements
        await prisma.fIEngagement.updateMany({
            where: { clientLEId: leId },
            data: { isDeleted: true }
        });

        // 4. Soft Delete the LE itself
        await prisma.clientLE.update({
            where: { id: leId },
            data: { isDeleted: true }
        });

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("Delete ClientLE Failed", e);
        return { success: false, error: "Failed to delete entity" };
    }
}

// 8. Client-Side Engagement Deletion
export async function deleteEngagementByClient(engagementId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    // 1. Find the Engagement -> ClientLE -> ClientOrg
    const engagement = await prisma.fIEngagement.findUnique({
        where: { id: engagementId },
        select: { id: true, clientLEId: true }
    });

    if (!engagement) return { success: false, error: "Engagement not found" };

    // Standardized Check
    // We need to resolve the LE from the Engagement to check permission on the LE context
    // Actually, ensureAuthorization supports engagementId? No, context needs explicit Party/LE usually.
    // Let's add engagement context resolution inside EnsureAuth? 
    // Or just resolve here.
    // But Action.ENG_DELETE logic in `permissions.ts`?
    // `permissions.ts` logic checks `getRoleForLE`. We need ClientLEId.

    // We already fetched engagement above with clientLEId
    try {
        await ensureAuthorization(Action.ENG_DELETE, { clientLEId: engagement.clientLEId, engagementId });
    } catch (e) {
        return { success: false, error: "Unauthorized: You do not have permission to delete engagements." };
    }

    try {
        // Cascade: Engagement -> Questionnaire Instances
        await prisma.questionnaire.updateMany({
            where: { fiEngagementId: engagementId },
            data: { isDeleted: true }
        });

        // Delete Engagement
        await prisma.fIEngagement.update({
            where: { id: engagementId },
            data: { isDeleted: true }
        });

        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        console.error("Delete Engagement Failed", e);
        return { success: false, error: "Failed to delete engagement" };
    }
}

export async function archiveClientLE(leId: string) {
    try {
        await ensureAuthorization(Action.LE_ARCHIVE, { clientLEId: leId });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        await prisma.clientLE.update({
            where: { id: leId },
            data: { status: "ARCHIVED" } // Assuming string status field
        });
        revalidatePath("/app");
        return { success: true };
    } catch (e) {
        return { success: false, error: "Failed to archive entity" };
    }
}



// 9. Search Financial Institutions
export async function searchFIs(query: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return [];
    const { userId } = identity;

    try {
        const fis = await prisma.organization.findMany({
            where: {
                types: { has: "FI" },
                name: { contains: query, mode: "insensitive" }
            },
            take: 10,
            orderBy: { name: 'asc' }
        });

        return fis.map((fi: any) => ({
            value: fi.id, // Use ID as value for uniqueness
            label: fi.name,
            description: fi.description || "Financial Institution"
        }));
    } catch (e) {
        console.error("Search FIs Failed", e);
        return [];
    }
}
// 10. Get Client Dashboard Data with Granular Permissions
// 10. Get Client Dashboard Data with Granular Permissions
export async function getClientDashboardData(clientId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId, email } = identity;

    try {
        // 1. Check for Direct Membership in the Client Organization
        const directMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: clientId,
            },
            include: { organization: true }
        });

        let org;
        let activeLes: any[] = [];
        let permissions = {
            canCreateLE: false,
            canManageOrg: false,
            canViewAllLEs: false
        };
        let roleLabel = "Restricted";

        // Logic for deriving permissions per LE based on context
        const deriveLEPermissions = (role: string) => {
            const isAdmin = role === "ADMIN" || role === "ORG_ADMIN" || role === "LE_ADMIN";
            const isMember = role === "MEMBER" || role === "ORG_MEMBER" || role === "LE_USER";
            return {
                canEnter: isAdmin || isMember,
                canEdit: isAdmin || isMember,
                canCreateRelationship: isAdmin || isMember,
                canDelete: isAdmin
            };
        };

        if (directMembership && directMembership.organization) {
            // CASE A: Direct Member (Admin or Member)
            if (directMembership.organization.status === "ARCHIVED") {
                return { success: false, error: "This Organization has been archived." };
            }

            org = directMembership.organization;
            const isOrgAdmin = directMembership.role === "ADMIN" || directMembership.role === "ORG_ADMIN";
            roleLabel = isOrgAdmin ? "Client Admin" : "Client Member";

            permissions.canCreateLE = isOrgAdmin;
            permissions.canManageOrg = isOrgAdmin;
            permissions.canViewAllLEs = true;

            // Fetch ALL active LEs for this Client Org
            const rawLes = await prisma.clientLE.findMany({
                where: {
                    owners: { some: { partyId: clientId, endAt: null } },
                    isDeleted: false,
                    status: { not: "ARCHIVED" }
                },
                include: {
                    fiEngagements: {
                        where: { isDeleted: false },
                        include: {
                            org: true, // Bank Name
                            questionnaires: {
                                where: { isDeleted: false },
                                include: { questions: true }
                            }
                        }
                    },
                    memberships: {
                        include: { user: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
            });

            // Hydrate with permissions and display name
            activeLes = rawLes.map((le: any) => ({
                ...le,
                displayName: getLEDisplayName(le),
                myPermissions: deriveLEPermissions(directMembership.role)
            }));

        } else {
            // CASE B: No Direct Membership -> Check for LE-scoped access
            const leMemberships = await prisma.membership.findMany({
                where: {
                    userId,
                    clientLE: {
                        owners: {
                            some: {
                                partyId: clientId,
                                endAt: null
                            }
                        }
                    }
                },
                include: {
                    clientLE: {
                        include: {
                            // clientOrg: true, // Removed
                            owners: {
                                where: { partyId: clientId, endAt: null },
                                include: { party: true }
                            },
                            fiEngagements: {
                                where: { isDeleted: false },
                                include: {
                                    org: true,
                                    questionnaires: {
                                        where: { isDeleted: false },
                                        include: { questions: true }
                                    }
                                }
                            },
                            memberships: {
                                include: { user: true }
                            }
                        }
                    }
                }
            });

            if (leMemberships.length === 0) {
                return { success: false, error: "Unauthorized" };
            }

            if (!leMemberships[0].clientLE) return { success: false, error: "Invalid Membership Data" };
            // org = leMemberships[0].clientLE.clientOrg;
            const contextOwner = leMemberships[0].clientLE?.owners?.[0];
            org = contextOwner?.party;

            if (org?.status === "ARCHIVED") {
                return { success: false, error: "This Organization has been archived." };
            }

            roleLabel = "Restricted (LE Scope)";

            permissions.canCreateLE = false;
            permissions.canManageOrg = false;
            permissions.canViewAllLEs = false; // Restricted

            const leMap = new Map();
            leMemberships.forEach((m: any) => {
                if (m.clientLE && !m.clientLE.isDeleted && m.clientLE.status !== "ARCHIVED") {
                    const leWithPerms = {
                        ...m.clientLE,
                        displayName: getLEDisplayName(m.clientLE),
                        myPermissions: deriveLEPermissions(m.role)
                    };
                    leMap.set(m.clientLE.id, leWithPerms);
                }
            });
            activeLes = Array.from(leMap.values());
        }

        return {
            success: true,
            data: {
                org,
                les: activeLes,
                permissions,
                roleLabel,
                userId, // For debug info
                email: email
            }
        };

    } catch (error) {
        console.error("[getClientDashboardData]", error);
        return { success: false, error: "Failed to load dashboard data" };
    }
}

// 12. Get Current User's Effective Role for an LE
// Returns 'LE_ADMIN', 'LE_USER', 'ORG_ADMIN' (owner), 'SYSTEM_ADMIN', or null.
export async function getCurrentUserLERole(leId: string): Promise<string | null> {
    const identity = await getIdentity();
    if (!identity?.userId) return null;
    const { userId } = identity;

    // 1. System Admin override
    const isSysAdmin = await checkIsSystemAdmin(userId);
    if (isSysAdmin) return "SYSTEM_ADMIN";

    // 2. Direct LE membership (LE_ADMIN or LE_USER)
    const leMembership = await prisma.membership.findFirst({
        where: { userId, clientLEId: leId, role: { in: ["LE_ADMIN", "LE_USER"] } },
        select: { role: true }
    });
    if (leMembership) return leMembership.role;

    // 3. Org membership for the LE's owner org (inherits ORG_ADMIN rights)
    const owners = await prisma.clientLEOwner.findMany({
        where: { clientLEId: leId, endAt: null },
        select: { partyId: true }
    });
    const ownerOrgIds = owners.map((o: any) => o.partyId);
    if (ownerOrgIds.length > 0) {
        const orgMembership = await prisma.membership.findFirst({
            where: { userId, organizationId: { in: ownerOrgIds }, role: { in: ["ADMIN", "ORG_ADMIN", "CLIENT_ADMIN"] } },
            select: { role: true }
        });
        if (orgMembership) return "ORG_ADMIN";
    }

    return null;
}

// 12b. Get LE Users
export interface LEUser {
    membershipId: string;
    userId: string;
    name: string | null;
    email: string;
    role: string;
}

export async function getLEUsers(leId: string): Promise<LEUser[]> {
    try {
        await ensureAuthorization(Action.LE_VIEW_MASTER_DATA, { clientLEId: leId });
    } catch (e) {
        return [];
    }

    const memberships = await prisma.membership.findMany({
        where: {
            clientLEId: leId,
            role: { in: ["LE_ADMIN", "LE_USER"] }
        },
        include: { user: true }
    });

    return memberships.map((m: any) => ({
        membershipId: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role
    }));
}

// 13. Invite User to LE — DEPRECATED: Use inviteUser from src/actions/invitations.ts
// This shim is kept temporarily for any remaining call sites and delegates to the unified system.
/** @deprecated Use inviteUser from src/actions/invitations.ts instead. */
export async function inviteUserToLE(leId: string, email: string, role: string) {
    const { inviteUser } = await import("@/actions/invitations");
    return inviteUser({ email, role, clientLEId: leId });
}

// 14. Remove LE User Access
export async function removeLEMembership(membershipId: string) {
    // Look up membership to find its clientLEId
    const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
        select: { clientLEId: true }
    });

    if (!membership || !membership.clientLEId) {
        return { success: false, error: "Membership not found or not an LE membership" };
    }

    // Verify current user can manage users for this ClientLE
    try {
        await ensureAuthorization(Action.LE_MANAGE_USERS, { clientLEId: membership.clientLEId });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    // Delete just this specific membership
    await prisma.membership.delete({
        where: { id: membershipId }
    });

    return { success: true };
}

// 15. Update LE User Role
export async function updateLEMembershipRole(membershipId: string, role: string) {
    if (!["LE_ADMIN", "LE_USER"].includes(role)) {
        return { success: false, error: "Invalid role specified." };
    }

    const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
        select: { clientLEId: true }
    });

    if (!membership || !membership.clientLEId) {
        return { success: false, error: "Membership not found or not an LE membership" };
    }

    // Verify current user can manage users for this ClientLE
    try {
        await ensureAuthorization(Action.LE_MANAGE_USERS, { clientLEId: membership.clientLEId });
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    await prisma.membership.update({
        where: { id: membershipId },
        data: { role }
    });

    return { success: true };
}
