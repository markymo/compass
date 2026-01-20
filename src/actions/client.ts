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

// 1. Get List of Client LEs with Dashboard Data
export async function getClientLEs() {
    const { userId, sessionClaims } = await auth();
    if (!userId) return [];

    // Get the user's Org
    const email = (sessionClaims?.email as string) || "";
    const org = await ensureUserOrg(userId, email);

    return await prisma.clientLE.findMany({
        where: {
            clientOrgId: org.id,
            isDeleted: false,
            status: { not: "ARCHIVED" }
        },
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
    const le = await prisma.clientLE.findUnique({
        where: { id: leId },
        include: {
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

    if (le) {
        le.fiEngagements.forEach(eng => {
            console.log(`[getClientLEData] Engagement ${eng.org.name} has ${eng.questionnaires.length} ACTIVE questionnaires`);
        });
    }

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

// 5. Update LE Basic Info (e.g. Description)
export async function updateClientLE(leId: string, data: { description: string }) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    console.log(`[updateClientLE] Attempting update for ${leId} with description: ${data.description}`);
    try {
        const updated = await prisma.clientLE.update({
            where: { id: leId },
            data: {
                description: data.description
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
                    if (task.status === "DONE") {
                        answeredQuestions++;
                        cpStatus.done++;
                    } else if (task.status === "SHARED") {
                        cpStatus.shared++;
                    } else if (task.status === "INTERNAL_REVIEW" || task.status === "QUERY") {
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

    const org = await ensureUserOrg(userId); // Re-fetch to confirm ID
    const le = await prisma.clientLE.findFirst({
        where: { id: leId, clientOrgId: org.id }
    });
    if (!le) return { success: false, error: "Legal Entity not found or unauthorized" };

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

    const org = await ensureUserOrg(userId);

    // Verify ownership: The engagement must belong to a ClientLE owned by this user's Org
    const engagement = await prisma.fIEngagement.findFirst({
        where: {
            id: engagementId,
            clientLE: {
                clientOrgId: org.id
            }
        }
    });

    if (!engagement) return { success: false, error: "Engagement not found or unauthorized" };

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
