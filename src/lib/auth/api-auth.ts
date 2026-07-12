import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Action, can, UserWithMemberships } from "@/lib/auth/permissions";

export async function ensureApiAuthorization(action: Action, context: { partyId?: string, clientLEId?: string, engagementId?: string }) {
    const identity = await getIdentity();
    if (!identity?.userId) throw new Error("Unauthorized: No User");
    const { userId } = identity;

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
