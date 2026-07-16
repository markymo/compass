import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCCAddresses } from "@/actions/cc-address-actions";
import { CCAddressManager } from "@/components/client/ccc/cc-address-manager";

interface AddressesPageProps {
    params: Promise<{ id: string }>;
}

export default async function AddressesPage({ params }: AddressesPageProps) {
    const { id } = await params;
    const le = await prisma.clientLE.findUnique({ where: { id }, select: { id: true } });
    if (!le) return notFound();

    const curatedAddresses = await getCCAddresses(id);
    return (
        <div className="space-y-4">
            <CCAddressManager clientLEId={id} initialAddresses={curatedAddresses} />
        </div>
    );
}
