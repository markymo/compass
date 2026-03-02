// TODO: Future removal - this page, the "Deprecated" tab, and also workbench2 & workbench3
import { LEConsole } from "@/components/client/le-console";

export default async function WorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <LEConsole leId={id} />
    );
}
