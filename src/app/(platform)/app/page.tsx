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
    const isV1 = homeParam === "v1";

    const contexts = await getUserContexts();
    const isAdmin = await isSystemAdmin();

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <StandardPageHeader
                title="Relationships"
                subtitle="Your Organisations, Legal Entities and Relationships."
                breadcrumbs={[{ label: "Home", href: "/app", icon: Home }]}
                actions={
                    isAdmin ? (
                        <HomeVariantSwitcher currentVariant={isV1 ? "v1" : "v2"} />
                    ) : undefined
                }
            />

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 w-full">
                {isV1 ? (
                    <DashboardContentV2 contexts={contexts} />
                ) : (
                    <ExperimentalDashboardContent contexts={contexts} />
                )}
            </div>
        </div>
    );
}
