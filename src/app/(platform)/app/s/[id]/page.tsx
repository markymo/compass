import {
    getFIOganization,
    getSupplierRelationshipsSummary,
} from "@/actions/fi";
import { notFound, redirect } from "next/navigation";
import { FIDashboardHeader } from "@/components/fi/fi-dashboard-header";
import { SupplierRelationshipsView } from "@/components/fi/supplier-relationships-view";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { HeaderNavList } from "@/components/layout/HeaderNavList";
import { getFIPortalTabs } from "@/config/navigation-tabs";

export default async function FIDashboard({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id } = await params;
    const resolvedSearchParams = await searchParams;

    // Handle legacy tab query parameter redirects cleanly
    if (resolvedSearchParams?.tab) {
        const tab = Array.isArray(resolvedSearchParams.tab)
            ? resolvedSearchParams.tab[0]
            : resolvedSearchParams.tab;

        if (tab === "workbench") {
            return redirect(`/app/s/${id}/questions`);
        }
        if (tab === "questionnaires") {
            return redirect(`/app/s/${id}/questionnaires`);
        }
        if (tab === "team") {
            return redirect(`/app/s/${id}/team`);
        }
        return redirect(`/app/s/${id}`);
    }

    const expandId = Array.isArray(resolvedSearchParams?.expand)
        ? resolvedSearchParams.expand[0]
        : resolvedSearchParams?.expand;

    const [org, relationships] = await Promise.all([
        getFIOganization(id),
        getSupplierRelationshipsSummary(id),
    ]);

    if (!org) return notFound();

    const fiTabs = getFIPortalTabs(org.id);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <SetPageBreadcrumbs
                items={[
                    { label: "Home", href: "/app", iconName: "home" },
                    { label: org.name, iconName: "landmark" }
                ]}
                title="Client Relationships"
                typeLabel="Financial Institution"
                secondaryNav={<HeaderNavList items={fiTabs} />}
            />

            <FIDashboardHeader org={org} />

            <SupplierRelationshipsView
                orgId={org.id}
                orgName={org.name}
                relationships={relationships}
                initialExpandedId={expandId}
            />
        </div>
    );
}
