import prisma from "@/lib/prisma";
import { Action, can } from "@/lib/auth/permissions";
import { ActorContext } from "@/lib/auth/actor-context";

export interface RelationshipSummary {
    id: string;
    fiOrgId: string;
    fiOrgName: string;
    clientLEId: string;
    clientLEName: string;
    status: string;
    dueDate: Date | null;
    questionnaireCount: number;
}

/**
 * Secured Application Service operation for retrieving relationship summary data.
 * 
 * Boundary Contract:
 * 1. Receives an ActorContext.
 * 2. Enforces resource authorization internally via `can(...)`.
 * 3. Throws explicit security exception if access is denied.
 * 4. Invokes domain/query logic.
 * 5. Returns a transport-independent domain payload suitable for Web, MCP, API, or Automation.
 */
export async function getRelationshipSummary(
    actor: ActorContext,
    relationshipId: string
): Promise<RelationshipSummary> {
    // 1. Enforce resource authorization at the application service boundary
    const allowed = await can(
        actor,
        Action.ENG_VIEW_RELEASED_DATA,
        { engagementId: relationshipId },
        prisma
    );

    if (!allowed) {
        throw new Error(`Unauthorized: Actor ${actor.id} lacks access to relationship ${relationshipId}`);
    }

    // 2. Query domain data
    const engagement = await prisma.fIEngagement.findFirst({
        where: { id: relationshipId, isDeleted: false },
        include: {
            org: { select: { id: true, name: true } },
            clientLE: { select: { id: true, name: true } },
            questionnaireInstances: {
                where: { isDeleted: false },
                select: { id: true }
            }
        }
    });

    if (!engagement) {
        throw new Error(`Relationship not found: ${relationshipId}`);
    }

    // 3. Return transport-independent domain payload
    return {
        id: engagement.id,
        fiOrgId: engagement.fiOrgId,
        fiOrgName: engagement.org.name,
        clientLEId: engagement.clientLEId,
        clientLEName: engagement.clientLE.name,
        status: engagement.status,
        dueDate: engagement.dueDate,
        questionnaireCount: engagement.questionnaireInstances.length,
    };
}
