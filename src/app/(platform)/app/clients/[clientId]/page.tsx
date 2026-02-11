import { getClientDashboardData } from "@/actions/client";
import { CreateLEDialog } from "@/components/client/create-le-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Briefcase, ArrowRight, Building2, Users, CreditCard, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { AccessDebugInfo } from "@/components/dev/AccessDebugInfo";
import { GuideHeader } from "@/components/layout/GuideHeader";
import { Home } from "lucide-react";

interface ClientDashboardPageProps {
    params: Promise<{ clientId: string }>;
}

export default async function ClientDashboardPage({ params }: ClientDashboardPageProps) {
    const { clientId } = await params;

    // 1. Fetch Data with Permissions
    const response = await getClientDashboardData(clientId);

    if (!response.success || !response.data) {
        return <div>Unauthorized or Organization not found</div>;
    }

    const { org, les, permissions, roleLabel, userId, email } = response.data;

    // Calculate Stats


    return (
        <div className="flex flex-col min-h-screen">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app", icon: Home },
                    { label: org.name, icon: Building2 }
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
                                        {roleLabel}
                                    </Badge>
                                </div>
                                <p className="text-slate-600 mt-2 text-lg">
                                    Manage your legal entities and banking relationships in one place.
                                </p>
                            </div>


                        </div>

                        {/* Management Section (Admins Only) */}
                        {permissions.canManageOrg && (
                            <div className="mt-8">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Organization Management</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Link href={`/app/clients/${org.id}/team`}>
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

                                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-not-allowed opacity-75">
                                        <CardContent className="p-5 flex items-start gap-4">
                                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                                                <CreditCard className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-700">Billing & Invoicing</h3>
                                                <p className="text-sm text-slate-500 mt-1">View invoices and usage.</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-not-allowed opacity-75">
                                        <CardContent className="p-5 flex items-start gap-4">
                                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                                                <Activity className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-700">Activity Log</h3>
                                                <p className="text-sm text-slate-500 mt-1">Monitor system changes.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Entity List */}
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-800">
                            {permissions.canViewAllLEs ? "Legal Entities" : "Your Entities"}
                        </h2>
                        {/* Conditional Action: Only Admins can create LEs */}
                        {permissions.canCreateLE && (
                            <CreateLEDialog orgId={org.id} />
                        )}
                    </div>

                    {les.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-white rounded-full shadow-sm">
                                    <Briefcase className="h-8 w-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">No entities found</h3>
                                <p className="text-slate-500 max-w-sm">
                                    {permissions.canCreateLE
                                        ? "Create your first legal entity to start managing your compliance data."
                                        : "You don't have access to any Legal Entities yet."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {les.map((le: any) => {
                                const isAccessible = le.myPermissions?.canEnter;

                                const CardComponent = (
                                    <Card className={`border-slate-200 shadow-sm transition-all ${isAccessible ? 'hover:shadow-md hover:border-indigo-200 cursor-pointer group' : 'opacity-75 bg-slate-50'}`}>
                                        <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                                                    <h3 className={`font-semibold text-base sm:text-lg ${isAccessible ? 'text-slate-900 group-hover:text-indigo-700' : 'text-slate-700'} truncate`}>
                                                        {le.name}
                                                    </h3>
                                                    <Badge variant="outline" className="text-xs font-normal text-slate-600 bg-slate-50 shrink-0">
                                                        {le.jurisdiction || 'Unknown'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-slate-500 line-clamp-1 sm:line-clamp-2">
                                                    {le.description || "No description provided."}
                                                </p>
                                            </div>
                                            {isAccessible && (
                                                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                            )}
                                        </CardContent>
                                    </Card>
                                );

                                return isAccessible ? (
                                    <Link key={le.id} href={`/app/le/${le.id}`} className="block">
                                        {CardComponent}
                                    </Link>
                                ) : (
                                    <div key={le.id}>
                                        {CardComponent}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <AccessDebugInfo
                        data={{
                            userId,
                            email: email as string | undefined,
                            roleLabel,
                            permissions,
                            contextId: org.id,
                            contextName: org.name
                        }}
                    />
                </div>
            </div>
        </div>

    );
}
