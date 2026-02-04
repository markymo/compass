"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { can, Action, UserWithMemberships } from "@/lib/auth/permissions";

import { cookies } from "next/headers";

// --- Authorization Helper ---
async function ensureAuthorization(action: Action, context: { partyId?: string, clientLEId?: string, engagementId?: string }) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized: No User");

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

            // Transactional Merge
            await prisma.$transaction(async (tx) => {
                // 1. Move Memberships
                await tx.membership.updateMany({
                    where: { userId: existingUserByEmail.id },
                    data: { userId: userId }
                });

                // 2. Move Comments/Activities/Todos if any (Optional but good practice)
                await tx.comment.updateMany({ where: { userId: existingUserByEmail.id }, data: { userId: userId } });
                await tx.questionActivity.updateMany({ where: { userId: existingUserByEmail.id }, data: { userId: userId } });

                // 3. Delete Placeholder
                await tx.user.delete({
                    where: { id: existingUserByEmail.id }
                });

                // 4. Create New User (The upsert below would do this, but we do it inside tx to be safe)
                await tx.user.create({
                    data: { id: userId, email: userEmail, name: existingUserByEmail.name }
                });
            });

            console.log(`[ensureUserOrg] Merge complete. Welcome ${userEmail}`);
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

    // Ensure User exists (Standard Upsert for non-merge cases)
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
        await prisma.user.create({
            data: { id: userId, email: userEmail || "unknown@demo.com" }
        });
    } else {
        // Update email if needed
        if (userEmail && userExists.email !== userEmail) {
            await prisma.user.update({ where: { id: userId }, data: { email: userEmail } });
        }
    }

    // Creating a default org if NONE exist is arguably still useful for new users to have a playground,
    // but in Global Context, we might just let them see an empty dashboard with "Create Client" button.
    // For legacy compatibility, let's keep creating it if they have absolutely nothing, but don't return it.

    const count = await prisma.membership.count({ where: { userId } });
    if (count === 0) {
        await prisma.organization.create({
            data: {
                name: userEmail ? `${userEmail.split('@')[0]}'s Corp` : "My Demo Client",
                types: ["CLIENT"],
                memberships: {
                    create: {
                        userId: userId,
                        role: "ADMIN"
                    }
                }
            }
        });
    }
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
    const { userId } = await auth();
    if (!userId) return [];

    const memberships = await prisma.membership.findMany({
        where: { userId, organizationId: { not: null } },
        include: { organization: true }
    });

    // Deduplicate and filter nulls
    const uniqueOrgs = new Map();
    memberships.forEach(m => {
        if (m.organization) {
            uniqueOrgs.set(m.organization.id, m.organization);
        }
    });

    return Array.from(uniqueOrgs.values());
}

// 1. Get List of Client LEs with Dashboard Data
export async function getClientLEs(explicitOrgId?: string) {
    const { userId, sessionClaims } = await auth();
    if (!userId) return [];

    // Ensure user record exists (and email is synced)
    const email = (sessionClaims?.email as string) || "";
    await ensureUserOrg(userId, email);

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

// 2. Create a new LE
export async function createClientLE(data: { name: string; jurisdiction: string; explicitOrgId?: string; lei?: string; gleifData?: any }) {
    const { userId, sessionClaims } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    let targetOrgId = data.explicitOrgId;

    // If valid targetOrgId is not resolved, try to resolve a default
    if (!targetOrgId) {
        // Fetch all client memberships where user is ADMIN
        const adminMemberships = await prisma.membership.findMany({
            where: {
                userId,
                role: "ADMIN",
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

    const newLE = await prisma.clientLE.create({
        data: {
            name: data.name,
            jurisdiction: data.jurisdiction,
            // @ts-ignore - Prisma client types may be stale in IDE
            lei: data.lei,
            gleifData: data.gleifData,
            gleifFetchedAt: data.gleifData ? new Date() : null,
            status: "ACTIVE",
            owners: {
                create: {
                    partyId: targetOrgId!,
                    startAt: new Date()
                }
            }
        },
    });

    revalidatePath("/app/le");
    // Also revalidate the client dashboard if we know the path - but it uses dynamic ID so revalidating /app/clients/[id] is tricky without the ID here.
    // Ideally we return the path to redirect or revalidatePath acts globally enough.
    // Actually, revalidatePath layout might be safer:
    revalidatePath("/app/clients/[clientId]");

    return { success: true, data: newLE };
}

// 3. Get Full Data (Schema + Answers) for an LE
export async function getClientLEData(leId: string) {
    try {
        await ensureAuthorization(Action.LE_VIEW_DATA, { clientLEId: leId });
    } catch (e) {
        console.error(`[getClientLEData] Auth Failed for ${leId}:`, e);
        return null; // Return null if unauthorized for read
    }

    const { userId } = await auth();
    if (!userId) return null;

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
                    }
                }
            }
        }
    });

    if (!le) {
        console.error(`[getClientLEData] LE not found in DB: ${leId}`);
        return null;
    }

    le.fiEngagements.forEach(eng => {
        console.log(`[getClientLEData] Engagement ${eng.org.name} has ${eng.questionnaires.length} ACTIVE questionnaires`);
    });

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
        await ensureAuthorization(Action.LE_EDIT_DATA, { clientLEId: leId });
    } catch (e) {
        return { success: false, error: "Unauthorized: Access denied." };
    }

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

// 5. Update LE Basic Info (e.g. Description)
export async function updateClientLE(leId: string, data: { description?: string, lei?: string, gleifData?: any }) {
    try {
        await ensureAuthorization(Action.LE_UPDATE, { clientLEId: leId });
    } catch (e) {
        return { success: false, error: "Unauthorized: Access denied." };
    }

    const { userId } = await auth();
    try {
        const updated = await prisma.clientLE.update({
            where: { id: leId },
            data: {
                description: data.description,
                ...(data.lei !== undefined && { lei: data.lei }),
                ...(data.gleifData !== undefined && {
                    gleifData: data.gleifData,
                    gleifFetchedAt: new Date()
                })
            }
        });
        console.log(`[updateClientLE] Update successful:`, JSON.stringify(updated, null, 2));

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
        await ensureAuthorization(Action.LE_VIEW_DATA, { clientLEId: leId });
    } catch (e) {
        return null;
    }

    const { userId } = await auth();
    if (!userId) return null;

    // A. Fetch Core Data
    const le = await prisma.clientLE.findUnique({
        where: { id: leId },
        include: {
            standingDataSections: true,
            fiEngagements: {
                where: { isDeleted: false },
                include: {
                    org: true,
                    questionnaires: {
                        where: { isDeleted: false },
                        include: {
                            questions: true // Fetch individual questions for "Closing Tracker"
                        }
                    }
                }
            }
        }
    });

    if (!le) return null;

    // B. Calculate Scores & CP Tracker
    const standingDataCount = le.standingDataSections.length;
    const standingDataScore = Math.min(standingDataCount, 5) / 5 * 60;

    let totalQuestions = 0;
    let answeredQuestions = 0;

    // CP Tracker Buckets
    let cpStatus = {
        draft: 0,           // Internal: Drafting
        internalReview: 0,  // Internal: Reviewing
        shared: 0,          // External: With Bank
        done: 0             // Complete
    };

    for (const eng of le.fiEngagements) {
        for (const q of eng.questionnaires) {
            // Use Relation-based questions if available (The new Kanban way)
            if (q.questions && q.questions.length > 0) {
                for (const task of q.questions) {
                    totalQuestions++;
                    const s = task.status;

                    if (s === "SUPPLIER_SIGNED_OFF") {
                        answeredQuestions++;
                        cpStatus.done++;
                    } else if (s === "SHARED" || s === "SUPPLIER_REVIEW" || s === "CLIENT_SIGNED_OFF") {
                        // Waiting on Supplier or in shared state
                        cpStatus.shared++;
                    } else if (s === "INTERNAL_REVIEW" || s === "QUERY") {
                        cpStatus.internalReview++;
                    } else {
                        // DRAFT or others
                        cpStatus.draft++;
                    }
                }
            }
            // Fallback for Legacy/Imported data (Extracted Content JSON)
            else if (q.extractedContent && Array.isArray(q.extractedContent)) {
                const items = q.extractedContent as any[];
                const questions = items.filter(i => i.type === "QUESTION");
                totalQuestions += questions.length;
                const answered = questions.filter(i => !!i.answer).length;
                answeredQuestions += answered;

                // Estimate status for legacy items
                cpStatus.done += answered;
                cpStatus.draft += (questions.length - answered);
            }
        }
    }

    const questionnaireScore = totalQuestions > 0
        ? (answeredQuestions / totalQuestions) * 40
        : 0;

    // C. Activity Feed
    const logs = await prisma.usageLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5
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
            }
        },
        pipeline: le.fiEngagements.map(e => ({
            id: e.id,
            fiName: e.org.name,
            status: e.status
        })),
        activity: logs.map(l => ({
            id: l.id,
            action: l.action,
            time: l.createdAt,
            user: "You"
        }))
    };
}
// 7. Archive / Delete Client LE
// 7. Archive / Delete Client LE
export async function deleteClientLE(leId: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };
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
        const engagementIds = engagements.map(e => e.id);

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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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

    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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
    const { userId } = await auth();
    if (!userId) return [];

    try {
        const fis = await prisma.organization.findMany({
            where: {
                types: { has: "FI" },
                name: { contains: query, mode: "insensitive" }
            },
            take: 10,
            orderBy: { name: 'asc' }
        });

        return fis.map(fi => ({
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
    const { userId, sessionClaims } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

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
                            questionnaires: { where: { isDeleted: false } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
            });

            // Hydrate with permissions
            activeLes = rawLes.map(le => ({
                ...le,
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
                                    questionnaires: { where: { isDeleted: false } }
                                }
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
            roleLabel = "Restricted (LE Scope)";

            permissions.canCreateLE = false;
            permissions.canManageOrg = false;
            permissions.canViewAllLEs = false; // Restricted

            const leMap = new Map();
            leMemberships.forEach((m: any) => {
                if (m.clientLE && !m.clientLE.isDeleted && m.clientLE.status !== "ARCHIVED") {
                    const leWithPerms = {
                        ...m.clientLE,
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
                email: sessionClaims?.email
            }
        };

    } catch (error) {
        console.error("[getClientDashboardData]", error);
        return { success: false, error: "Failed to load dashboard data" };
    }
}
