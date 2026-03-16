import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { GleifTab } from "@/components/client/gleif-tab";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function GleifPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const { le } = data;

    return (
        <>
            <SetPageBreadcrumbs 
                items={[]}
            />
            <GleifTab
                leId={le.id}
                data={{
                    ...(le as any).gleifData,
                    nationalRegistryData: (le as any).nationalRegistryData
                }}
                fetchedAt={(le as any).gleifFetchedAt}
            />
        </>
    );
}
