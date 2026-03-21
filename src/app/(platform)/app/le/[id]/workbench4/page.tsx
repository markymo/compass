import { getWorkbench4Data } from "@/actions/kyc-workbench";
import { CrossQuestionnaireMapper } from "@/components/client/workbench/cross-questionnaire-mapper";
import { notFound } from "next/navigation";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function Workbench4Page({ params }: { params: Promise<{ id: string }> }) {
    const { id: leId } = await params;

    const data = await getWorkbench4Data(leId);

    if (!data) return notFound();

    return (
        <div className="p-6">
            <SetPageBreadcrumbs 
                items={[]}
            />

            <CrossQuestionnaireMapper
                leId={leId}
                initialData={data}
            />
        </div>
    );
}
