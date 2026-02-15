import { StandingDataWorkbench } from "@/components/client/standing-data-workbench";

export default async function KnowledgeBasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <div className="bg-white rounded-xl min-h-[600px] p-8 border border-slate-200">
            <StandingDataWorkbench leId={id} />
        </div>
    );
}
