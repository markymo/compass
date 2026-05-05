import { getUserContexts } from "@/actions/dashboard";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { DashboardContentV2 } from "@/components/dashboard/dashboard-content-v2";
import Link from "next/link";
import { Home } from "lucide-react";

export default async function DashboardPageV2() {
    const contexts = await getUserContexts();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <StandardPageHeader
                title="Relationships (v2)"
                subtitle="Your Organisations, Legal Entities and Relationships."
                breadcrumbs={[{ label: "Home", href: "/app", icon: Home }]}
            />

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 w-full">
                <DashboardContentV2 contexts={contexts} />

            </div>
        </div>
    );
}
