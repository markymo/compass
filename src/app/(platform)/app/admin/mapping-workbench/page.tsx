import { getMappingWorkbenchData } from "@/actions/mapping-workbench";
import { MappingWorkbench } from "@/components/client/admin/mapping-workbench/MappingWorkbench";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Mapping Workbench | Admin",
    description: "Trace source fields through master schema, claims, and questionnaire usage from one screen.",
};

export default async function MappingWorkbenchPage() {
    const data = await getMappingWorkbenchData();
    return <MappingWorkbench data={data} />;
}
