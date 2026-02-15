import { LEConsole } from "@/components/client/le-console";

export default async function WorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <LEConsole leId={id} />
    );
}
