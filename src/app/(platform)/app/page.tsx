import { getUserContexts } from "@/actions/dashboard";
import { isSystemAdmin } from "@/actions/security";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { DashboardContentV2 } from "@/components/dashboard/dashboard-content-v2";
import { ExperimentalDashboardContent } from "@/components/dashboard/experimental/experimental-dashboard-content";
import { HomeVariantSwitcher } from "@/components/dashboard/home-variant-switcher";
import { Home } from "lucide-react";

interface PageProps {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
    const sp = searchParams ? await searchParams : {};
    const homeParam = typeof sp.home === "string" ? sp.home : undefined;
    const isV2 = homeParam === "v2";

    const contexts = await getUserContexts();
    const isAdmin = await isSystemAdmin();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <StandardPageHeader
                title="Relationships"
                subtitle="Your Organisations, Legal Entities and Relationships."
                breadcrumbs={[{ label: "Home", href: "/app", icon: Home }]}
                actions={
                    isAdmin ? (
                        <HomeVariantSwitcher currentVariant={isV2 ? "v2" : "v1"} />
                    ) : undefined
                }
            />

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 w-full">
                {isV2 ? (
                    <ExperimentalDashboardContent contexts={contexts} />
                ) : (
                    <DashboardContentV2 contexts={contexts} />
                )}
            </div>
        </div>
    );
}
