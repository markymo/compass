import { DocumentVault } from "@/components/client/document-vault";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function VaultPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <div className="h-full">
            <SetPageBreadcrumbs 
                items={[]}
            />
            <DocumentVault leId={id} />
        </div>
    );
}
