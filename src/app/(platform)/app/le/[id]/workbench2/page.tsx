import { Pattern2CommandCenter } from "@/components/client/workbench/pattern2-command-center";

export default async function Workbench2Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <Pattern2CommandCenter leId={id} />
    );
}
