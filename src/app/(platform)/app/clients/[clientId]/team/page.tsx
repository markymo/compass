import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import ClientTeamPage from "@/components/client/team-page-client";
import { getPendingInvitations } from "@/actions/invitations";
import { notFound } from "next/navigation";

export default async function TeamPageWrapper({ params }: { params: Promise<{ clientId: string }> }) {
    // Await params for Next.js 15 compatibility
    const { clientId } = await params;
    const { userId } = await auth();

    if (!userId) return <div>Unauthorized</div>;

    // 1. Fetch Organization Details
    const org = await prisma.organization.findUnique({
        where: { id: clientId },
        select: { name: true, types: true }
    });

    if (!org) return notFound();

    // 2. Check Permission (Can Manage?)
    // Simple check: Is user an ADMIN of this Org?
    const membership = await prisma.membership.findFirst({
        where: {
            userId,
            organizationId: clientId,
            role: { in: ["ADMIN", "ORG_ADMIN"] }
        }
    });
    const canManage = !!membership;

    // 3. Fetch Active Users
    const activeMembers = await prisma.membership.findMany({
        where: {
            // Gets members of the Org OR members of LEs owned by this Org?
            // "Team" usually implies Party Members.
            // But we also want to see LE-only guests (Contractors).
            OR: [
                { organizationId: clientId },
                { clientLE: { owners: { some: { partyId: clientId, endAt: null } } } }
            ]
        },
        include: {
            user: true,
            clientLE: { select: { name: true } }
        },
        orderBy: { user: { email: 'asc' } }
    });

    // 5. Fetch ALL Client LEs (for matrix view)
    const allClientLEs = await prisma.clientLE.findMany({
        where: {
            owners: {
                some: {
                    partyId: clientId,
                    endAt: null,
                }
            }
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    console.log(`[TeamPageWrapper] Fetched ${allClientLEs.length} Client LEs for ${clientId}:`, allClientLEs.map(l => l.name));


    // Deduplicate and Group Users
    const userMap = new Map<string, any>();

    activeMembers.forEach(m => {
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

    // Group Invites by Email
    const inviteMap = new Map<string, any>();
    rawInvites.forEach((inv: any) => {
        if (!inviteMap.has(inv.email)) {
            inviteMap.set(inv.email, {
                email: inv.email,
                items: []
            });
        }
        const entry = inviteMap.get(inv.email);
        entry.items.push(inv);
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
