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
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Description</h1>
                <p className="text-slate-500 mt-2 max-w-4xl leading-relaxed">
                    We maintain a single, structured profile of your organisation that captures the core facts banks repeatedly ask for, built from public registers and your previously approved answers, so future KYC and onboarding questionnaires can be completed automatically with a full audit trail.
                </p>
            </div>

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
