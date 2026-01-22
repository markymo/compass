import { getClientLEs, ensureUserOrg } from "@/actions/client";
import { CreateLEDialog } from "@/components/client/create-le-dialog";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Briefcase, ArrowRight, Building2, FileText, CheckCircle2, Cloud, AlertCircle, Shield } from "lucide-react";
import { RedirectTo } from "@/components/layout/RedirectTo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ClientDashboardPage() {
    const { userId, sessionClaims } = await auth();
    const user = await currentUser();

    const email = (sessionClaims?.email as string) || "";
    // We already call this inside getClientLEs but we need the org object for the check
    const org = await ensureUserOrg(userId!, email);

    // SECURITY: If user is strictly an FI, redirect to FI Dashboard
    if (org && org.types.includes("FI") && !org.types.includes("SYSTEM")) {
        return <RedirectTo path="/app/fi" />;
    }

    const les = await getClientLEs();

    // Calculate Stats
    const totalEntities = les.length;
    const activeEngagements = les.reduce((acc, le) => acc + le.fiEngagements.length, 0);
    const activeQuestionnaires = les.reduce((acc, le) =>
        acc + le.fiEngagements.reduce((qAcc, eng) => qAcc + eng.questionnaires.length, 0), 0
    );

    return (
        <div className="space-y-8 pb-12">
            {/* Hero Section */}
            <div className="bg-slate-50 -mx-6 -mt-6 px-6 py-12 border-b border-slate-200">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                Welcome back, {user?.firstName || 'User'}
                            </h1>
                            <p className="text-slate-600 mt-2 text-lg">
                                Manage your legal entities and banking relationships in one place.
                            </p>
                        </div>
                        <CreateLEDialog />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                        <Card className="bg-white/50 border-slate-200 shadow-sm">
                            <CardContent className="pt-6 flex items-center gap-4">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                    <Shield className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{totalEntities}</p>
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Legal Entities</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/50 border-slate-200 shadow-sm">
                            <CardContent className="pt-6 flex items-center gap-4">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{activeEngagements}</p>
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Banks</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/50 border-slate-200 shadow-sm">
                            <CardContent className="pt-6 flex items-center gap-4">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{activeQuestionnaires}</p>
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Questionnaires</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Entity List */}
            <div className="max-w-5xl mx-auto space-y-6">
                <h2 className="text-xl font-semibold text-slate-800">Your Entities</h2>

                {les.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50">
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-white rounded-full shadow-sm">
                                <Briefcase className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">No entities found</h3>
                            <p className="text-slate-500 max-w-sm">Create your first legal entity to start managing your compliance data.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {les.map((le) => (
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
                                            <Link href={`/app/le/${le.id}/v2`} className="hover:underline decoration-slate-400 underline-offset-4">
                                                <h3 className="text-xl font-bold text-slate-900">{le.name}</h3>
                                            </Link>
                                            <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                                                {le.description || "No description provided."}
                                            </p>
                                        </div>
                                        <div className="mt-6 pt-6 border-t border-slate-200/50">
                                            <Link href={`/app/le/${le.id}/v2`}>
                                                <Button className="w-full gap-2 group">
                                                    Manage Entity
                                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Right: Engagements */}
                                    <div className="p-6 md:w-2/3">
                                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                                            <Cloud className="h-4 w-4 text-indigo-500" />
                                            Engagements
                                        </h4>

                                        {le.fiEngagements.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                                                <p className="text-sm">No active banking engagements</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {le.fiEngagements.map((eng) => (
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
            </div>
        </div>
    );
}
