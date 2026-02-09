
import {
    getFIOganization,
} from "@/actions/fi";
import { Home, Landmark, Search, ArrowRight } from "lucide-react";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { PortfolioSummary, ActivityFeed } from "@/components/fi/dashboard-widgets";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function FIDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const org = await getFIOganization(id);

    if (!org) return <div>Unauthorized</div>;

    return (
        <div className="flex flex-col min-h-screen">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app", icon: Home },
                    { label: org?.name || "Financial Institution", icon: Landmark }
                ]}
            />
            <div className="space-y-8 animate-in fade-in duration-500 py-6 px-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Welcome back, here is what is happening in your portfolio.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button asChild>
                            <Link href={`/app/fi/${id}/engagements`}>
                                View All Relationships <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <PortfolioSummary />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <ActivityFeed />

                    {/* Right column: Quick Actions / System Status? */}
                    <div className="space-y-6">
                        <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4">
                            <h3 className="font-semibold text-indigo-900 mb-2 text-sm">Quick Actions</h3>
                            <div className="space-y-2">
                                <Button variant="outline" className="w-full justify-start text-indigo-700 bg-white border-indigo-200 hover:bg-indigo-50">
                                    + Invite New Client
                                </Button>
                                <Button variant="outline" className="w-full justify-start text-indigo-700 bg-white border-indigo-200 hover:bg-indigo-50">
                                    Create New Questionnaire
                                </Button>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                            <h3 className="font-semibold text-slate-900 mb-2 text-sm">System Status</h3>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                APIs Operational
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Webhooks Active
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
