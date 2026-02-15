import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { DataSchemaTab } from "@/components/client/data-schema-tab";

export default async function MasterRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const { le } = data;

    return (
        <div className="bg-white rounded-xl min-h-[600px] p-8 border border-slate-200">
            <DataSchemaTab
                leId={le.id}
                identityProfile={(le as any).identityProfile}
            />
        </div>
    );
}
