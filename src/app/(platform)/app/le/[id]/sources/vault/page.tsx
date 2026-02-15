import { DocumentVault } from "@/components/client/document-vault";

export default async function VaultPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <div className="h-full">
            <DocumentVault leId={id} />
        </div>
    );
}
