import prisma from "@/lib/prisma";
import { UserWithMemberships } from "./permissions";

export type AccessChannel = "WEB" | "MCP" | "API" | "SYSTEM";

/**
 * Formalized ActorContext representing the authenticated identity, membership scopes,
 * transport channel, and optional client/service credentials across all OnPro entry points.
 */
export interface ActorContext extends UserWithMemberships {
    channel: AccessChannel;
    clientId?: string;
    servicePrincipalId?: string;
}

/**
 * Constructs a canonical ActorContext for an authenticated user identity.
 * Compatible directly with the permission engine `can(actor, action, context, prisma)`.
 */
export async function getActorContext(
    userId: string,
    channel: AccessChannel = "WEB",
    options?: { clientId?: string; servicePrincipalId?: string }
): Promise<ActorContext> {
    const memberships = await prisma.membership.findMany({
        where: { userId },
        select: {
            organizationId: true,
            clientLEId: true,
            fiEngagementId: true,
            role: true,
        },
    });

    return {
        id: userId,
        memberships,
        channel,
        clientId: options?.clientId,
        servicePrincipalId: options?.servicePrincipalId,
    };
}
