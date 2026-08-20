import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { Action, can, UserWithMemberships } from "@/lib/auth/permissions";
import { isSystemAdmin } from "@/actions/security";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const identity = await getIdentity();

    if (!identity?.userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    const { userId } = identity;

    // 1. Fetch Questionnaire
    const questionnaire = await prisma.questionnaire.findUnique({
        where: { id },
        include: {
            fiEngagement: {
                select: {
                    id: true,
                    clientLEId: true,
                    clientLE: { select: { isDeleted: true, status: true } }
                }
            }
        }
    });

    if (!questionnaire || !questionnaire.fileContent) {
        return new NextResponse("File not found", { status: 404 });
    }

    // Authorize access against engagement / LE / template
    const sysAdmin = await isSystemAdmin();
    let allowed = sysAdmin;

    if (!allowed) {
        const memberships = await prisma.membership.findMany({
            where: { userId },
            select: {
                organizationId: true,
                clientLEId: true,
                fiEngagementId: true,
                role: true,
                clientLE: { select: { isDeleted: true, status: true } }
            }
        });
        const user: UserWithMemberships = { id: userId, memberships };

        if (questionnaire.fiEngagement?.clientLEId) {
            allowed = await can(user, Action.LE_VIEW_MASTER_DATA, { clientLEId: questionnaire.fiEngagement.clientLEId }, prisma);
        }
        if (!allowed && questionnaire.fiEngagementId) {
            allowed = await can(user, Action.ENG_VIEW_RELEASED_DATA, { engagementId: questionnaire.fiEngagementId }, prisma);
        }
        if (!allowed && questionnaire.fiOrgId) {
            allowed = await can(user, Action.QUESTIONNAIRE_UPDATE, { partyId: questionnaire.fiOrgId }, prisma);
        }
    }

    if (!allowed) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    // 2. Prepare headers
    const headers = new Headers();
    headers.set("Content-Type", questionnaire.fileType || "application/pdf");
    headers.set("Content-Disposition", `inline; filename="${questionnaire.fileName || 'questionnaire.pdf'}"`);

    // 3. Return the file
    return new NextResponse(questionnaire.fileContent, {
        status: 200,
        headers,
    });
}

