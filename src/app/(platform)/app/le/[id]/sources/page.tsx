import { ClientRedirect } from "@/components/layout/client-redirect";

export default async function SourcesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // Default redirect to GLEIF tab
    return <ClientRedirect to={`/app/le/${id}/sources/gleif`} />;
}
