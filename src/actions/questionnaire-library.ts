
"use server";

import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { extractDetailedContent } from "@/actions/questionnaire";
import { isSystemAdmin } from "@/actions/security";

// 1. Get questionnaires already in the LE's library
export async function getLibraryEngagements(leId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId: leId },
            include: {
                org: true,
                questionnaires: true
            },
            orderBy: { status: 'asc' }
        });
        return { success: true, data: engagements };
    } catch (error) {
        console.error("[getLibraryEngagements]", error);
        return { success: false, error: "Failed to fetch library" };
    }
}



// 2. Search discoverable Reference Snapshots for the caller's organisation.
//    Uses visibility-aware discovery: GLOBAL snapshots are discoverable by all eligible
//    orgs; PRIVATE and RESTRICTED snapshots are discoverable only by their owner org.
//    Replaces the legacy isGlobal=true query.
//
//  engagementId (optional): when provided the discovery context is resolved from
//  FIEngagement.fiOrgId — the authoritative organisation for the engagement.
//  Without engagementId the function falls back to the user's membership org
//  (for non-engagement callers such as a standalone library browser).
export async function searchAvailableQuestionnaires(query: string, engagementId?: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const isSysAdmin = await isSystemAdmin();

        let callerOrgId: string | null = null;

        if (isSysAdmin) {
            // System admins are resolved to the SYSTEM org, identified by org type.
            // Do NOT use a hardcoded shortCode — it varies between environments.
            const sysOrg = await prisma.organization.findFirst({
                where: { types: { has: "SYSTEM" } },
                select: { id: true },
            });
            callerOrgId = sysOrg?.id ?? null;
        } else if (engagementId) {
            // ── Engagement-context resolution ────────────────────────────────
            // The authoritative org is the FI org that owns the engagement.
            // This ensures that:
            //   • PRIVATE snapshots owned by that FI org are discoverable.
            //   • PRIVATE snapshots owned by other orgs the user belongs to are NOT shown.
            //   • GLOBAL snapshots are always shown regardless.
            const engagement = await prisma.fIEngagement.findUnique({
                where: { id: engagementId },
                select: { fiOrgId: true },
            });
            callerOrgId = engagement?.fiOrgId ?? null;
        } else {
            // ── Fallback: membership-based resolution ────────────────────────
            // Used when there is no engagement context (e.g. standalone library page).
            // Prefer FI / CLIENT / SUPPLIER typed orgs, then any org.
            const typedMembership = await prisma.membership.findFirst({
                where: {
                    userId,
                    organizationId: { not: null },
                    organization: { types: { hasSome: ["FI", "CLIENT", "SUPPLIER"] } },
                },
                select: { organizationId: true },
                orderBy: { createdAt: "asc" },
            });
            const anyMembership = typedMembership ?? await prisma.membership.findFirst({
                where: { userId, organizationId: { not: null } },
                select: { organizationId: true },
                orderBy: { createdAt: "asc" },
            });
            callerOrgId = anyMembership?.organizationId ?? null;
        }

        if (!callerOrgId) {
            return { success: true, data: [] };
        }

        // Visibility-enforced discovery
        const { getDiscoverableReferenceSnapshotsForOrg } = await import("@/actions/questionnaires-v2");
        const snapshots = await getDiscoverableReferenceSnapshotsForOrg(callerOrgId);

        // Apply optional search filter across all meaningful text fields.
        // Users commonly search by functional code ("fmsb"), reference code prefix,
        // snapshot name, or owner org name — so all four are checked.
        const normalised = query.trim().toLowerCase();
        const filtered = normalised
            ? snapshots.filter(s =>
                s.name.toLowerCase().includes(normalised) ||
                (s.referenceCode ?? "").toLowerCase().includes(normalised) ||
                (s.functionalCode ?? "").toLowerCase().includes(normalised) ||
                (s.ownerOrgName ?? "").toLowerCase().includes(normalised)
            )
            : snapshots;

        // Shape response to match existing UI expectations.
        // fiOrg is always a non-null object; legacy snapshots with ownerOrgId=null
        // fall back to 'Coparity' so the dialog renderer never sees null.name.
        const data = filtered.slice(0, 20).map(s => ({
            id: s.id,
            name: s.name,
            status: "ACTIVE",
            updatedAt: s.updatedAt,
            fiOrg: {
                id: s.ownerOrgId ?? "",
                name: s.ownerOrgName ?? "Coparity",
                logoUrl: null,
            },
        }));

        return { success: true, data };
    } catch (error) {
        console.error("[searchAvailableQuestionnaires]", error);
        return { success: false, error: "Search failed" };
    }
}

// 3. Link a questionnaire to an LE (Preparation Mode)
export async function linkQuestionnaireToLE(leId: string, questionnaireId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const questionnaire = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId }
        });

        if (!questionnaire) return { success: false, error: "Questionnaire not found" };

        // Create or find engagement
        const engagement = await prisma.fIEngagement.upsert({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId: questionnaire.fiOrgId,
                    clientLEId: leId
                }
            },
            update: {
                questionnaires: {
                    connect: { id: questionnaireId }
                }
            },
            create: {
                fiOrgId: questionnaire.fiOrgId,
                clientLEId: leId,
                status: "PREPARATION" as any,
                questionnaires: {
                    connect: { id: questionnaireId }
                }
            }
        });

        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true, data: engagement };
    } catch (error) {
        console.error("[linkQuestionnaireToLE]", error);
        return { success: false, error: "Failed to link questionnaire" };
    }
}

// 4. Client Upload: Find/Create FI, Create Questionnaire, then link
export async function uploadClientQuestionnaire(leId: string, fiName: string, formData: FormData) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    const file = formData.get("file") as File;
    const questionnaireName = formData.get("name") as string || file.name;

    if (!file) return { success: false, error: "File is required" };

    try {
        // Find user's Client Org to set ownership
        const userMembership = await prisma.membership.findFirst({
            where: { userId, organization: { types: { has: "CLIENT" } } },
            select: { organizationId: true }
        });

        // Find or Create FI Org
        let fiOrg = await prisma.organization.findFirst({
            where: {
                name: { equals: fiName, mode: 'insensitive' },
                types: { has: "FI" }
            }
        });

        if (!fiOrg) {
            fiOrg = await prisma.organization.create({
                data: {
                    name: fiName,
                    types: ["FI"]
                }
            });
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Create Questionnaire
        const questionnaire = await prisma.questionnaire.create({
            data: {
                fiOrgId: fiOrg.id,
                name: questionnaireName,
                fileName: file.name,
                fileType: file.type,
                fileContent: buffer,
                status: "ACTIVE",
                ownerOrgId: userMembership?.organizationId // Set ownership!
            }
        });

        // Trigger AI Extraction (Async/Fire-and-forget or await?)
        // Let's await it so the user sees results immediately
        await extractDetailedContent(questionnaire.id);

        // Link to LE
        const linkRes = await linkQuestionnaireToLE(leId, questionnaire.id);
        if (!linkRes.success) {
            console.error("Failed to link after upload:", linkRes.error);
            return { success: false, error: linkRes.error };
        }

        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true };
    } catch (error) {
        console.error("[uploadClientQuestionnaire]", error);
        return { success: false, error: "Upload failed" };
    }
}

// 5. Get all FIs for the selector
export async function getFIs() {
    return await prisma.organization.findMany({
        where: { types: { has: "FI" } },
        orderBy: { name: 'asc' }
    });
}

// 6. Remove (Unlink) a questionnaire from an LE
export async function removeQuestionnaireFromLibrary(leId: string, questionnaireId: string) {
    const identity = await getIdentity();
    if (!identity?.userId) return { success: false, error: "Unauthorized" };
    const { userId } = identity;

    try {
        const questionnaire = await prisma.questionnaire.findUnique({
            where: { id: questionnaireId },
            select: { fiOrgId: true }
        });

        if (!questionnaire) return { success: false, error: "Questionnaire not found" };

        await prisma.fIEngagement.delete({
            where: {
                fiOrgId_clientLEId: {
                    fiOrgId: questionnaire.fiOrgId,
                    clientLEId: leId
                }
            }
        });

        revalidatePath(`/app/le/${leId}/v2`);
        return { success: true };
    } catch (error) {
        console.error("[removeQuestionnaireFromLibrary]", error);
        return { success: false, error: "Failed to remove questionnaire" };
    }
}
