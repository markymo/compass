import { Pattern1SmartForm } from "@/components/client/workbench/pattern1-smart-form";

export default async function Workbench1Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <Pattern1SmartForm leId={id} />
    );
}
