import {
    getFIOganization,
    getFIWorkbenchData,
} from "@/actions/fi";
import { notFound } from "next/navigation";
import { FIDashboardHeader } from "@/components/fi/fi-dashboard-header";
import { SupplierQuestionsWorkbench } from "@/components/fi/supplier-questions-workbench";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { HeaderNavList } from "@/components/layout/HeaderNavList";
import { getFIPortalTabs } from "@/config/navigation-tabs";

export default async function FIQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [org, workbenchData] = await Promise.all([
        getFIOganization(id),
        getFIWorkbenchData(id),
    ]);

    if (!org) return notFound();

    const fiTabs = getFIPortalTabs(org.id);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <SetPageBreadcrumbs
                items={[
                    { label: "Home", href: "/app", iconName: "home" },
                    { label: org.name, href: `/app/s/${id}`, iconName: "landmark" },
                    { label: "Questions & Answers", iconName: "help-circle" }
                ]}
                title="Questions & Answers"
                typeLabel="Financial Institution"
                secondaryNav={<HeaderNavList items={fiTabs} />}
            />

            <FIDashboardHeader org={org} />

            <div className="max-w-7xl mx-auto w-full p-8">
                <SupplierQuestionsWorkbench orgId={org.id} data={workbenchData} />
            </div>
        </div>
    );
}
