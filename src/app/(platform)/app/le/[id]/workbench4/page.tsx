import { Suspense } from "react";
import { getWorkbench4Data } from "@/actions/kyc-workbench";
import { CrossQuestionnaireMapper } from "@/components/client/workbench/cross-questionnaire-mapper";
import { notFound } from "next/navigation";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function Workbench4Page({ params }: { params: Promise<{ id: string }> }) {
    const { id: leId } = await params;

    const data = await getWorkbench4Data(leId);

    if (!data) return notFound();

    return (
        <div className="space-y-6">
            <SetPageBreadcrumbs 
                items={[]}
                isWide={true}
            />

            <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading Workbench...</div>}>
                <CrossQuestionnaireMapper
                    leId={leId}
                    initialData={data}
                />
            </Suspense>
        </div>
    );
}
