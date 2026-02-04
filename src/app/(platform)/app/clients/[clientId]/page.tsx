import { getClientDashboardData } from "@/actions/client";
import { CreateLEDialog } from "@/components/client/create-le-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Briefcase, ArrowRight, Building2, FileText, Cloud, AlertCircle, Shield, Users, CreditCard, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
                        <div className="grid gap-6">
                            {les.map((le: any) => (
                                <Card key={le.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow border-slate-200">
                                    <div className="flex flex-col md:flex-row">
                                        {/* Left: Entity Info */}
                                        <div className="p-6 md:w-1/3 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="outline" className="bg-white shadow-sm border-slate-200 text-slate-600">
                                                        {le.jurisdiction || 'Unknown Jurisdiction'}
                                                    </Badge>
                                                    {le.status === 'ACTIVE' && (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Active</Badge>
                                                    )}
                                                </div>
                                                {le.myPermissions?.canEnter ? (
                                                    <Link href={`/app/le/${le.id}`} className="hover:underline decoration-slate-400 underline-offset-4">
                                                        <h3 className="text-xl font-bold text-slate-900">{le.name}</h3>
                                                    </Link>
                                                ) : (
                                                    <h3 className="text-xl font-bold text-slate-700">{le.name}</h3>
                                                )}
                                                <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                                                    {le.description || "No description provided."}
                                                </p>
                                            </div>
                                            <div className="mt-6 pt-6 border-t border-slate-200/50">
                                                {le.myPermissions?.canEnter ? (
                                                    <Link href={`/app/le/${le.id}`}>
                                                        <Button className="w-full gap-2 group">
                                                            Manage Entity
                                                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                        </Button>
                                                    </Link>
                                                ) : (
                                                    <Button disabled variant="secondary" className="w-full gap-2 opacity-50 cursor-not-allowed">
                                                        Restricted Access
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Engagements */}
                                        <div className="p-6 md:w-2/3">
                                            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                                                <Cloud className="h-4 w-4 text-indigo-500" />
                                                Relationships
                                            </h4>

                                            {le.fiEngagements.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                    <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                                                    <p className="text-sm">No active relationships</p>
                                                </div>
                                            ) : (
                                                <div className="grid gap-3">
                                                    {le.fiEngagements.map((eng: any) => (
                                                        <div key={eng.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                                    {eng.org.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <Link href={`/app/le/${le.id}/engagement-new/${eng.id}`} className="hover:text-indigo-600 hover:underline">
                                                                        <p className="font-medium text-slate-900 text-sm">{eng.org.name}</p>
                                                                    </Link>
                                                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                                                        {eng.questionnaires.length} Questionnaires
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Badge variant="secondary" className="text-[10px] uppercase">
                                                                {eng.status}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
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
