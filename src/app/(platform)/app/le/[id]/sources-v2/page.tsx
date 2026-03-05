import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { SourcesV2Client } from "@/components/client/sources-v2/sources-v2-client";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function SourcesV2Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) {
        return notFound();
    }

    const { le } = data;

    return (
        <div className="w-full">
            <SetPageBreadcrumbs
                items={[
                    { label: "Sources V2", iconName: "layers" }
                ]}
            />
            {/* The wrapper handles max-w-6xl usually, but we can rely on the LayoutShell for standard padding */}
            <div className="space-y-6">
                <SourcesV2Client
                    leId={le.id}
                    leName={le.name}
                    lei={le.lei}
                    gleifData={le.gleifData}
                    gleifFetchedAt={le.gleifFetchedAt}
                />
            </div>
        </div>
    );
}
