
import { EcosystemManager } from "@/components/super-admin/EcosystemManager";
import { getEcosystemTree, getAllSuppliers } from "@/actions/ecosystem";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function EcosystemPage() {
    const tree = await getEcosystemTree();
    const suppliers = await getAllSuppliers();

    return (
        <div className="w-full max-w-[1600px] mx-auto py-8 px-6">
            <div className="mb-6">
                <Button variant="ghost" size="sm" asChild className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                    <Link href="/app/admin/super">
                        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Admin Dashboard
                    </Link>
                </Button>
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-8">Ecosystem Management</h1>

            <EcosystemManager tree={tree} initialSuppliers={suppliers} />
        </div>
    );
}
