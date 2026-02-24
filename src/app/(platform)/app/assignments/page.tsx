import { getIdentity } from "@/lib/auth";
import { getUserAssignments } from "@/actions/kyc-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, FileQuestion, Database, ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function GlobalAssignmentsPage() {
    const identity = await getIdentity();

    if (!identity?.userId) {
        redirect("/login");
    }

    const assignments = await getUserAssignments(identity.userId);

    // Global view: directly use all returned assignments across all workspaces
    const allQuestions = assignments.questions;
    const allMasterFields = assignments.masterFields;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-b pb-4">My Dashboard</h1>
                <p className="text-sm text-slate-500 mt-2">
                    Global view of all tasks and data points assigned to you across all clients and workspaces.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Questions Column */}
                <Card className="flex flex-col shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                                <FileQuestion className="h-4 w-4" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Assigned Questions</CardTitle>
                                <CardDescription>Questions requiring your input or review</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        {allQuestions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                                <ClipboardCheck className="h-10 w-10 mb-3 opacity-20" />
                                <p className="text-sm">No active questions assigned to you.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {allQuestions.map(q => (
                                    <div key={q.id} className="p-4 hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="text-[10px] bg-white border-slate-300">
                                                        {q.status}
                                                    </Badge>
                                                    {q.engagementOrgName && (
                                                        <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            {q.engagementOrgName}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-slate-500 truncate">
                                                        • {q.questionnaireName}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-900 line-clamp-2">
                                                    {q.text}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    Assigned by {q.assignedByUserName} on {q.createdAt.toLocaleDateString()}
                                                </p>
                                            </div>
                                            {q.clientLEId ? (
                                                <Link
                                                    href={`/app/le/${q.clientLEId}/workbench2?questionId=${q.id}`}
                                                    className="shrink-0 h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors bg-white mt-1"
                                                >
                                                    <ArrowRight className="h-4 w-4" />
                                                </Link>
                                            ) : (
                                                <div className="shrink-0 h-8 w-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 bg-slate-50 mt-1" title="Missing Workspace Context">
                                                    <ArrowRight className="h-4 w-4" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Master Fields Column */}
                <Card className="flex flex-col shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                                <Database className="h-4 w-4" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Master Data Assignments</CardTitle>
                                <CardDescription>Authoritative data points under your responsibility</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        {allMasterFields.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                                <ClipboardCheck className="h-10 w-10 mb-3 opacity-20" />
                                <p className="text-sm">No master fields assigned to you.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {allMasterFields.map(f => (
                                    <div key={f.id} className="p-4 hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="text-[10px] bg-white border-slate-300">
                                                        Field {f.fieldNo}
                                                    </Badge>
                                                    {f.engagementOrgName && (
                                                        <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            {f.engagementOrgName}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-slate-900 line-clamp-1">
                                                    {f.fieldName}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    Assigned by {f.assignedByUserName} on {f.createdAt.toLocaleDateString()}
                                                </p>
                                            </div>
                                            {f.clientLEId ? (
                                                <Link
                                                    href={`/app/le/${f.clientLEId}/master?fieldNo=${f.fieldNo}`}
                                                    className="shrink-0 h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:border-emerald-200 group-hover:bg-emerald-50 transition-colors bg-white mt-1"
                                                >
                                                    <ArrowRight className="h-4 w-4" />
                                                </Link>
                                            ) : (
                                                <div className="shrink-0 h-8 w-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 bg-slate-50 mt-1" title="Missing Workspace Context">
                                                    <ArrowRight className="h-4 w-4" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
