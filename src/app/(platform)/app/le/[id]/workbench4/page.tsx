import { getWorkbench4Data } from "@/actions/kyc-workbench";
import { CrossQuestionnaireMapper } from "@/components/client/workbench/cross-questionnaire-mapper";
import { notFound } from "next/navigation";

export default async function Workbench4Page({ params }: { params: Promise<{ id: string }> }) {
    const { id: leId } = await params;

    const data = await getWorkbench4Data(leId);

    if (!data) return notFound();

    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Questionnaire Responses</h1>
            </div>

            <CrossQuestionnaireMapper
                leId={leId}
                initialData={data}
            />
        </div>
    );
}
