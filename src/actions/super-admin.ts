"use server";

import prisma from "@/lib/prisma";
import { Action, ensureAuthorization } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

// 1. Get System Stats
export async function getSystemStats() {
    try {
        await ensureAuthorization(Action.SYSTEM_VIEW_TELEMETRY, {});
    } catch {
        return null;
    }

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
    try {
        await ensureAuthorization(Action.SYSTEM_MANAGE_TENANTS, {});
    } catch {
        return { success: false, error: "Unauthorized" };
    }

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
    try {
        await ensureAuthorization(Action.SYSTEM_HARD_DELETE, {});
    } catch {
        return { success: false, error: "Unauthorized" };
    }

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
        await prisma.$transaction(async (tx: any) => {
            // 1. Delete PrivateDocumentUploadIntents
            await tx.privateDocumentUploadIntent.deleteMany({
                where: {
                    OR: [
                        { clientLEId: clientLEId },
                        { document: { clientLEId: clientLEId } }
                    ]
                }
            });

            // 2. Delete CCPartyDocument, CCParty, CCAddress
            await tx.cCPartyDocument.deleteMany({
                where: {
                    OR: [
                        { party: { clientLEId: clientLEId } },
                        { document: { clientLEId: clientLEId } }
                    ]
                }
            });
            await tx.cCParty.deleteMany({ where: { clientLEId: clientLEId } });
            await tx.cCAddress.deleteMany({ where: { clientLEId: clientLEId } });

            // 3. Delete QuestionnaireSubmissions
            await tx.questionnaireSubmission.deleteMany({ where: { clientLEId: clientLEId } });

            // 4. Delete FieldClaims scoped to this ClientLE
            await tx.fieldClaim.deleteMany({
                where: { clientLEId: clientLEId }
            });

            // 5. Delete Engagements & associated Questionnaires / Activities / Queries
            const engs = await tx.fIEngagement.findMany({ where: { clientLEId: clientLEId }, select: { id: true } });
            const engIds = engs.map((e: any) => e.id);
            if (engIds.length > 0) {
                await tx.questionnaire.deleteMany({ where: { fiEngagementId: { in: engIds } } });
                await tx.engagementActivity.deleteMany({ where: { fiEngagementId: { in: engIds } } });
                await tx.query.deleteMany({ where: { fiEngagementId: { in: engIds } } });
            }

            // 6. Delete Documents owned by ClientLE
            await tx.document.deleteMany({ where: { clientLEId: clientLEId } });

            // 7. Delete Invitations
            await tx.invitation.deleteMany({
                where: {
                    OR: [
                        { clientLEId: clientLEId },
                        ...(engIds.length > 0 ? [{ fiEngagementId: { in: engIds } }] : [])
                    ]
                }
            });

            // 8. Delete FIEngagements
            await tx.fIEngagement.deleteMany({ where: { clientLEId: clientLEId } });

            // 9. Delete Graph Edges then Nodes
            await tx.clientLEGraphEdge.deleteMany({ where: { clientLEId: clientLEId } });
            await tx.clientLEGraphNode.deleteMany({ where: { clientLEId: clientLEId } });

            // 10. Delete ClientLE Records, Data, Memberships, etc.
            await tx.clientLERecord.deleteMany({ where: { clientLEId: clientLEId } });
            await tx.standingDataSection.deleteMany({ where: { clientLEId: clientLEId } });
            await tx.masterFieldAssignment.deleteMany({ where: { clientLEId: clientLEId } });
            await tx.masterFieldNote.deleteMany({ where: { clientLEId: clientLEId } });
            await tx.lEActivity.deleteMany({ where: { leId: clientLEId } });
            await tx.membership.deleteMany({ where: { clientLEId: clientLEId } });

            // 11. Delete the ClientLE itself
            await tx.clientLE.delete({ where: { id: clientLEId } });
        });

        console.log(`[SuperAdmin] Successfully purged ClientLE: ${le.name} (${clientLEId})`);
        revalidatePath("/app/admin/users"); // If called from users dashboard
        revalidatePath("/app/admin/super");
        return { success: true };

    } catch (e) {
        console.error("[SuperAdmin] Purge Failed:", e);
        return { success: false, error: "Failed to purge Legal Entity data. Check server logs." };
    }
}
