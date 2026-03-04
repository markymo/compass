import { getFullMasterData } from "@/actions/client-le";
import { getCategoriesWithFields } from "@/actions/master-data-sort";
import { notFound } from "next/navigation";
import { DataSchemaTab } from "@/components/client/data-schema-tab";

export default async function MasterRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch flattened master data from all profiles
    const result = await getFullMasterData(id);
    const dataSort = await getCategoriesWithFields();

    if (!result.success) return notFound();

    const { data: masterData, customData, customDefinitions, gleifLastSynced, masterFields, masterGroups } = result as any;

    return (
        <div className="p-6 max-w-[1600px] mx-auto">


            <DataSchemaTab
                leId={id}
                masterData={masterData || {}}
                customData={customData || {}}
                customDefinitions={customDefinitions || []}
                gleifLastSynced={gleifLastSynced ?? undefined}
                masterFields={masterFields || []}
                masterGroups={masterGroups || []}
                categories={dataSort.categories}
                uncategorizedFields={dataSort.uncategorizedFields}
            />
        </div>
    );
}
