import { getFullMasterData } from "@/actions/client-le";
import { getCategoriesWithFields } from "@/actions/master-data-sort";
import { notFound } from "next/navigation";
import { DataSchemaTab } from "@/components/client/data-schema-tab";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { EnrichmentGate } from "@/components/client/kyc/enrichment-gate";


export default async function MasterRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch flattened master data from all profiles
    const result = await getFullMasterData(id);
    const dataSort = await getCategoriesWithFields();

    if (!result.success) return notFound();

    const { 
        data: masterData, 
        customData, 
        customDefinitions, 
        gleifLastSynced, 
        nationalRegistryData, 
        masterFields, 
        masterGroups,
        enrichmentStatus,
        lei,
        registrationAuthorityId
    } = result as any;

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <SetPageBreadcrumbs 
                items={[]}
            />


            <EnrichmentGate 
                leId={id} 
                status={enrichmentStatus} 
                lei={lei} 
                raId={registrationAuthorityId}
            >
                <DataSchemaTab
                    leId={id}
                    masterData={masterData || {}}
                    customData={customData || {}}
                    customDefinitions={customDefinitions || []}
                    gleifLastSynced={gleifLastSynced ?? undefined}
                    nationalRegistryData={nationalRegistryData}
                    masterFields={masterFields || []}
                    masterGroups={masterGroups || []}
                    categories={dataSort.categories}
                    uncategorizedFields={dataSort.uncategorizedFields}
                />
            </EnrichmentGate>
        </div>
    );
}

