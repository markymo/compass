import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCCAddresses } from "@/actions/cc-address-actions";
import { CCAddressManager } from "@/components/client/ccc/cc-address-manager";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

interface UserAddressesPageProps {
    params: Promise<{ id: string }>;
}

export default async function UserAddressesPage({ params }: UserAddressesPageProps) {
    const { id } = await params;
    const le = await prisma.clientLE.findUnique({ where: { id }, select: { id: true } });
    if (!le) return notFound();

    const curatedAddresses = await getCCAddresses(id);
    return (
        <div className="space-y-6 max-w-5xl">
            <SetPageBreadcrumbs items={[]} />
            <CCAddressManager clientLEId={id} initialAddresses={curatedAddresses} />
        </div>
    );
}
