import { getWorkbench4Data } from "@/actions/kyc-workbench";
import { CrossQuestionnaireMapper } from "@/components/client/workbench/cross-questionnaire-mapper";
import { notFound } from "next/navigation";

export default async function Workbench4Page({ params }: { params: Promise<{ id: string }> }) {
    const { id: leId } = await params;

    const data = await getWorkbench4Data(leId);

    if (!data) return notFound();

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workbench: Global Mapping</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Manage all questions across relationships and questionnaires in a single view.
                    Map unmapped fields to your master schema or create new custom fields on the fly.
                </p>
            </div>

            <CrossQuestionnaireMapper
                leId={leId}
                initialData={data}
            />
        </div>
    );
}
