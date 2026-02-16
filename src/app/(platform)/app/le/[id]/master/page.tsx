import { getFullMasterData } from "@/actions/client-le";
import { notFound } from "next/navigation";
import { DataSchemaTab } from "@/components/client/data-schema-tab";

export default async function MasterRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch flattened master data from all profiles
    const { success, data } = await getFullMasterData(id);

    if (!success) return notFound();

    return (
        <div className="bg-white rounded-xl min-h-[600px] p-8 border border-slate-200">
            <DataSchemaTab
                leId={id}
                masterData={data}
            />
        </div>
    );
}
