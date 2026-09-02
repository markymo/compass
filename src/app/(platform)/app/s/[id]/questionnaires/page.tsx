import { getFIOganization, checkIsSupplierOrgAdmin } from "@/actions/fi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { notFound } from "next/navigation";
import { FIDashboardHeader } from "@/components/fi/fi-dashboard-header";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { HeaderNavList } from "@/components/layout/HeaderNavList";
import { getFIPortalTabs } from "@/config/navigation-tabs";

export default async function FIAdminPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [org, isOrgAdmin] = await Promise.all([
        getFIOganization(id),
        checkIsSupplierOrgAdmin(id),
    ]);
    if (!org || !isOrgAdmin) return notFound();

    const fiTabs = getFIPortalTabs(org.id, { isOrgAdmin: true });

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <SetPageBreadcrumbs
                items={[
                    { label: "Home", href: "/app", iconName: "home" },
                    { label: org.name, href: `/app/s/${id}`, iconName: "landmark" },
                    { label: "Admin", iconName: "settings" }
                ]}
                title="Admin"
                typeLabel="Financial Institution"
                secondaryNav={<HeaderNavList items={fiTabs} />}
            />

            <FIDashboardHeader org={org} />

            <div className="max-w-7xl mx-auto w-full p-8 space-y-6">
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="p-8 pb-6 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                                <Settings className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold text-slate-900">Admin</CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-medium mt-0.5">
                                    Supplier administration and configuration tools.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-3">
                        <p className="text-sm font-semibold text-slate-800">
                            Supplier administration will be available here in a future release.
                        </p>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Questionnaire templates and mappings are currently managed by OnPro administrators.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
