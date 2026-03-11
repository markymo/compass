import { getUserContexts } from "@/actions/dashboard";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import Link from "next/link";
import { Home } from "lucide-react";

export default async function DashboardPage() {
    const contexts = await getUserContexts();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <StandardPageHeader
                title="Relationships Overview"
                typeLabel="Overview"
                subtitle="Your Organisations, Legal Entities and Relationships."
                breadcrumbs={[{ label: "Home", href: "/app", icon: Home }]}
            />

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 w-full">
                <DashboardContent contexts={contexts} />

                {/* Footer link to Scout */}
                <div className="pt-4 border-t border-slate-100 text-center">
                    <Link href="/app/scout" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                        Switch to Scout view →
                    </Link>
                </div>
            </div>
        </div>
    );
}
