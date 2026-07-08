import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { getCCParties } from "@/actions/cc-party-actions";
import { CCPartyManager } from "@/components/client/ccc/cc-party-manager";
import { getCCAddresses } from "@/actions/cc-address-actions";
import { CCAddressManager } from "@/components/client/ccc/cc-address-manager";

interface CCCPageProps {
    params: Promise<{ id: string }>;
}

export default async function CCCPage({ params }: CCCPageProps) {
    const { id } = await params;

    // Verify Legal Entity existence
    const le = await prisma.clientLE.findUnique({
        where: { id },
        select: { id: true }
    });

    if (!le) {
        return notFound();
    }

    // Load curated parties and addresses
    const [curatedParties, curatedAddresses] = await Promise.all([
        getCCParties(id),
        getCCAddresses(id)
    ]);

    return (
        <div className="space-y-6 max-w-5xl">
            <SetPageBreadcrumbs
                items={[]}
            />

            {/* Header Area */}
            <div className="space-y-2 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2 text-slate-800">
                    <Layers className="h-6 w-6 text-slate-500" />
                    <h2 className="text-xl font-semibold tracking-tight">User Content</h2>
                </div>
                <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                    Manage your own custom Party and Address records for this Legal Entity. This content is entirely user-managed, providing a repository for your bespoke Individuals (Persons, Contacts) and Organisations (Companies, Trusts, Funds, Partnerships, etc.) distinct from external registries. Please note this interface is available during development, but entities may eventually be edited directly from the Master Data Fields.
                </p>
            </div>

            {/* Curated Parties Manager */}
            <CCPartyManager 
                clientLEId={id} 
                initialParties={curatedParties} 
            />

            {/* Curated Addresses Manager */}
            <CCAddressManager 
                clientLEId={id} 
                initialAddresses={curatedAddresses} 
            />
        </div>
    );
}
