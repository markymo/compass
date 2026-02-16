import { LegalEntityNav } from "@/components/layout/legal-entity-nav";
import { getClientLEData } from "@/actions/client"; // Reusing existing action if suitable or just fetch LE slightly lighter
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma"; // Direct prisma if needed for layout efficiency
import { GuideHeader } from "@/components/layout/GuideHeader";
import { Home, Building2, Briefcase } from "lucide-react";
import { ClientLEActions } from "@/components/client/client-le-actions";
import { checkIsSystemAdmin } from "@/actions/client";
import { getIdentity } from "@/lib/auth";

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}

export default async function LegalEntityLayout({ children, params }: LayoutProps) {
    const { id } = await params;

    // Verify LE exists for 404 & Get Breadcrumb Data
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

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50">

            <GuideHeader
                breadcrumbs={[
                    { label: "", href: "/app", icon: Home },
                    { label: ownerName || "Client", href: ownerId ? `/app/clients/${ownerId}` : "/app", icon: Building2 },
                    { label: le.name, icon: Briefcase }
                ]}
                actions={<ClientLEActions leId={le.id} leName={le.name} isSystemAdmin={isSystemAdmin} />}
            />

            <LegalEntityNav leId={id} />

            <main className="flex-1 max-w-6xl mx-auto w-full p-8">
                {children}
            </main>
        </div>
    );
}
