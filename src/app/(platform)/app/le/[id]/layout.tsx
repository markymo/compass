import { LegalEntityLayoutShell } from "@/components/layout/legal-entity-layout-shell";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { checkIsSystemAdmin } from "@/actions/client";
import { getIdentity } from "@/lib/auth";
import type { GuideBreadcrumbItem } from "@/components/layout/GuideHeader";
import { getLEDisplayName } from "@/lib/le-display-name";

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}

export default async function LegalEntityLayout({ children, params }: LayoutProps) {
    const { id } = await params;

    // Verify LE exists & Get Breadcrumb Data (Owner/Client)
    const le = await prisma.clientLE.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            owners: {
                where: { endAt: null },
                include: { party: true }
            },
            description: true,
            lei: true,
            dueDate: true,
            gleifFetchedAt: true,
            gleifData: true
        }
    });

    if (!le) {
        return notFound();
    }

    const owner = le.owners[0]?.party;
    const ownerName = owner?.name;
    const ownerId = owner?.id;

    // Check Admin status for Actions
    const identity = await getIdentity();
    const isSystemAdmin = identity?.userId ? await checkIsSystemAdmin(identity.userId) : false;

    // Check ORG_Admin for Name Editing (Can be System Admin OR Client Admin of owner org)
    let canEdit = isSystemAdmin;
    if (!canEdit && identity?.userId && ownerId) {
        const membership = await prisma.membership.findFirst({
            where: {
                userId: identity.userId,
                organizationId: ownerId,
                role: { in: ["ADMIN", "ORG_ADMIN", "CLIENT_ADMIN"] }
            }
        });
        canEdit = !!membership;
    }

    // Construct Base Breadcrumbs (Server-Side)
    const baseBreadcrumbs: GuideBreadcrumbItem[] = [
        { label: "Home", href: "/app", iconName: "home" },
        { label: ownerName || "Client", href: ownerId ? `/app/clients/${ownerId}` : "/app", iconName: "building-2" },
        { label: getLEDisplayName(le), href: `/app/le/${le.id}`, iconName: "landmark" }
    ];

    return (
        <LegalEntityLayoutShell
            baseBreadcrumbs={baseBreadcrumbs}
            leId={le.id}
            leName={le.name}
            leData={le}
            clientOrgName={ownerName || "Client"}
            isSystemAdmin={isSystemAdmin}
            canEdit={canEdit}
        >
            {children}
        </LegalEntityLayoutShell>
    );
}
