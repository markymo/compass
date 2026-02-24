import { Pattern3MappingMatrix } from "@/components/client/workbench/pattern3-mapping-matrix";

export default async function Workbench3Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <Pattern3MappingMatrix leId={id} />
    );
}
