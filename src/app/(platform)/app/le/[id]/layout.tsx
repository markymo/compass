import { LegalEntityLayoutShell } from "@/components/layout/legal-entity-layout-shell";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { checkIsSystemAdmin } from "@/actions/client";
import { getIdentity } from "@/lib/auth";
import type { GuideBreadcrumbItem } from "@/components/layout/GuideHeader";

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
            }
        }
    });

    if (!le) {
        return notFound();
    }

    const owner = le.owners[0]?.party;
    const ownerName = owner?.name;
    const ownerId = owner?.id;

    // Check System Admin for Actions
    const identity = await getIdentity();
    const isSystemAdmin = identity?.userId ? await checkIsSystemAdmin(identity.userId) : false;

    // Construct Base Breadcrumbs (Server-Side)
    const baseBreadcrumbs: GuideBreadcrumbItem[] = [
        { label: "", href: "/app", iconName: "home" },
        { label: ownerName || "Client", href: ownerId ? `/app/clients/${ownerId}` : "/app", iconName: "building-2" },
        { label: le.name, href: `/app/le/${le.id}`, iconName: "briefcase" }
    ];

    return (
        <LegalEntityLayoutShell
            baseBreadcrumbs={baseBreadcrumbs}
            leId={le.id}
            leName={le.name}
            isSystemAdmin={isSystemAdmin}
        >
            {children}
        </LegalEntityLayoutShell>
    );
}
