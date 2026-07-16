import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCCParties } from "@/actions/cc-party-actions";
import { CCPartyManager } from "@/components/client/ccc/cc-party-manager";

interface PartiesPageProps {
    params: Promise<{ id: string }>;
}

export default async function PartiesPage({ params }: PartiesPageProps) {
    const { id } = await params;
    const le = await prisma.clientLE.findUnique({ where: { id }, select: { id: true } });
    if (!le) return notFound();

    const curatedParties = await getCCParties(id);
    return (
        <div className="space-y-4">
            <CCPartyManager clientLEId={id} initialParties={curatedParties} />
        </div>
    );
}
