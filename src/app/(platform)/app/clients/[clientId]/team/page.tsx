import { getIdentity } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ClientTeamPage from "@/components/client/team-page-client";
import { getPendingInvitations } from "@/actions/invitations";
import { notFound } from "next/navigation";

export default async function TeamPageWrapper({ params }: { params: Promise<{ clientId: string }> }) {
    // Await params for Next.js 15 compatibility
    const { clientId } = await params;
    const identity = await getIdentity();
    const userId = identity?.userId;

    if (!userId) return notFound();

    // 1. Fetch Organization Details
    const org = await prisma.organization.findUnique({
        where: { id: clientId },
        select: { name: true, types: true }
    });

    if (!org) return notFound();

    // 2. Server-side Authorization Guard
    const orgMembership = await prisma.membership.findFirst({
        where: {
            userId,
            organizationId: clientId
        }
    });

    const isOrgAdmin = orgMembership?.role === "ADMIN" || orgMembership?.role === "ORG_ADMIN";
    const canManage = isOrgAdmin;

    // Check active LE memberships for LE-scoped users
    const userActiveLeMemberships = await prisma.membership.findMany({
        where: {
            userId,
            clientLE: {
                isDeleted: false,
                status: { not: "ARCHIVED" },
                owners: { some: { partyId: clientId, endAt: null } }
            }
        },
        select: { clientLEId: true }
    });

    const hasActiveLeAccess = userActiveLeMemberships.length > 0;
    const isAuthorized = !!orgMembership || hasActiveLeAccess;

    if (!isAuthorized) {
        return notFound();
    }

    const isOrgLevelUser = !!orgMembership;

    // 5. Fetch Client LEs for matrix view (filtering deleted/archived and scoping to user visibility)
    const leWhere: any = {
        isDeleted: false,
        status: { not: "ARCHIVED" },
        owners: {
            some: {
                partyId: clientId,
                endAt: null,
            }
        }
    };

    if (!isOrgLevelUser) {
        // Restricted LE user: only include active LEs assigned to the user
        const assignedLeIds = userActiveLeMemberships.map((m: any) => m.clientLEId).filter(Boolean);
        leWhere.id = { in: assignedLeIds };
    }

    const allClientLEs = await prisma.clientLE.findMany({
        where: leWhere,
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    // 3. Fetch Active Users (filtering out memberships on soft-deleted/archived LEs)
    const memberWhere: any = {
        OR: [
            { organizationId: clientId },
            {
                clientLE: {
                    isDeleted: false,
                    status: { not: "ARCHIVED" },
                    owners: { some: { partyId: clientId, endAt: null } }
                }
            }
        ]
    };

    if (!isOrgLevelUser) {
        // LE-scoped user: restrict to org members and members of their visible active LEs
        const visibleLeIds = allClientLEs.map((l: any) => l.id);
        memberWhere.OR = [
            { organizationId: clientId },
            { clientLEId: { in: visibleLeIds } }
        ];
    }

    const activeMembers = await prisma.membership.findMany({
        where: memberWhere,
        include: {
            user: true,
            clientLE: { select: { name: true, isDeleted: true } }
        },
        orderBy: { user: { email: 'asc' } }
    });

    // Deduplicate and Group Users
    const userMap = new Map<string, any>();

    activeMembers.forEach((m: any) => {
        if (m.clientLE && m.clientLE.isDeleted) return;

        if (!userMap.has(m.userId)) {
            userMap.set(m.userId, {
                id: m.userId,
                email: m.user.email,
                memberships: []
            });
        }

        const user = userMap.get(m.userId);
        user.memberships.push({
            role: m.role,
            scopeType: m.organizationId ? "ORG" : "LE",
            scopeName: m.organizationId ? "Entire Organization" : m.clientLE?.name,
            scopeId: m.organizationId || m.clientLEId
        });
    });

    const users = Array.from(userMap.values());

    // 4. Fetch Pending Invites
    const rawInvites = await getPendingInvitations(clientId);

    // Group Invites by Email (sentToEmail is the field on the unified Invitation model)
    const inviteMap = new Map<string, any>();
    rawInvites.forEach((inv: any) => {
        const email = inv.sentToEmail;
        if (!inviteMap.has(email)) {
            inviteMap.set(email, {
                email,
                items: []
            });
        }
        inviteMap.get(email).items.push(inv);
    });
    const groupedInvites = Array.from(inviteMap.values());

    return (
        <ClientTeamPage
            clientId={clientId}
            orgName={org.name}
            users={users}
            invites={groupedInvites}
            canManage={canManage}
            allClientLEs={allClientLEs}
        />
    );
}

