import { getMappingWorkbench2Data } from "@/actions/mapping-workbench-2";
import { MappingWorkbench2 } from "@/components/client/admin/mapping-workbench-2/MappingWorkbench2";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Mapping Workbench Idea 2 | Admin",
    description: "Three-column relational workbench: Source → Master Data → Questions.",
};

export default async function MappingWorkbench2Page() {
    const data = await getMappingWorkbench2Data();
    return <MappingWorkbench2 data={data} />;
}
