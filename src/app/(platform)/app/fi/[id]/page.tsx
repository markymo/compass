
import {
    getFIOganization,
    getFIEngagements,
} from "@/actions/fi";
import { Home, Landmark, Users, FileText, Settings, ArrowRight, Building2, Briefcase } from "lucide-react";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function FIDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [org, engagements] = await Promise.all([
        getFIOganization(id),
        getFIEngagements(id)
    ]);

    if (!org) return <div>Unauthorized</div>;

    return (
        <div className="flex flex-col min-h-screen">
            <GuideHeader
                breadcrumbs={[
                    { label: "", href: "/app", icon: Home },
                    { label: org.name, icon: Landmark }
                ]}
            />
            <div className="space-y-8 pb-12 p-8">
                {/* Hero Section */}
                <div className="bg-slate-50 -mx-6 -mt-6 px-6 py-12 border-b border-slate-200">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                        {org.name} Dashboard
                                    </h1>
                                    <Badge variant="secondary" className="text-xs uppercase tracking-wider font-mono">
                                        Supplier
                                    </Badge>
                                </div>
                                <p className="text-slate-600 mt-2 text-lg">
                                    Manage your client relationships and compliance requests.
                                </p>
                            </div>
                        </div>

                        {/* Management Section */}
                        <div className="mt-8">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Organization Admin</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Link href={`/app/fi/${org.id}/team`}>
                                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group h-full">
                                        <CardContent className="p-5 flex items-start gap-4">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-105 transition-transform">
                                                <Users className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">Team Members</h3>
                                                <p className="text-sm text-slate-500 mt-1">Manage user access and roles.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>

                                <Link href={`/app/fi/${org.id}/questionnaires`}>
                                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group h-full">
                                        <CardContent className="p-5 flex items-start gap-4">
                                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-105 transition-transform">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">Questionnaires</h3>
                                                <p className="text-sm text-slate-500 mt-1">Manage templates and forms.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>

                                <Link href={`/app/fi/${org.id}/settings`}>
                                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group h-full">
                                        <CardContent className="p-5 flex items-start gap-4">
                                            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:scale-105 transition-transform">
                                                <Settings className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">Settings</h3>
                                                <p className="text-sm text-slate-500 mt-1">Configure organization details.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Relationships List */}
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-800">
                            Client Relationships
                        </h2>
                        {engagements.length > 0 && (
                            <Button size="sm" variant="outline" asChild>
                                <Link href={`/app/fi/${id}/engagements`}>
                                    View All <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        )}
                    </div>

                    {engagements.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-white rounded-full shadow-sm">
                                    <Briefcase className="h-8 w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">No active relationships</h3>
                                <p className="text-slate-500 max-w-sm">
                                    You don't have any active engagements with Legal Entities yet.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {engagements.map((engagement) => {
                                const le = engagement.clientLE;
                                const ownerOrg = le.owners?.[0]?.party; // Approximating owner

                                return (
                                    <Link key={engagement.id} href={`/app/fi/${org.id}/engagements/${engagement.id}`} className="block">
                                        <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
                                            <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                                                        <h3 className="font-semibold text-base sm:text-lg text-slate-900 group-hover:text-indigo-700 truncate">
                                                            {le.name}
                                                        </h3>
                                                        <Badge variant="outline" className="text-xs font-normal text-slate-600 bg-slate-50 shrink-0">
                                                            {le.jurisdiction || 'Unknown'}
                                                        </Badge>
                                                        {engagement.status && (
                                                            <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-100">
                                                                {engagement.status}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="truncate">{ownerOrg?.name || "Unknown Client"}</span>
                                                    </div>
                                                </div>
                                                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
