"use client"

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    KanbanSquare,
    FileText,
    Settings,
    Users,
    Building2,
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    AlertCircle,
    Clock,
    Plus,
    Search
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

// Internal Components
import { FIKanbanBoard } from "./engagement/fi-kanban-board";
import { UploadQuestionnaireDialog } from "./upload-questionnaire-dialog";
import { FIWorkbench } from "./fi-workbench";

interface FIPortalContainerProps {
    org: any;
    engagements: any[];
    workbenchData: {
        questions: any[];
        les: string[];
        questionnaires: string[];
        categories: string[];
    };
    questionnaires: any[];
    teamMembers: any[];
    stats: any;
}

export function FIPortalContainer({ org, engagements, workbenchData, questionnaires, teamMembers, stats }: FIPortalContainerProps) {
    const [activeTab, setActiveTab] = useState("overview");

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-50 rounded-2xl border border-teal-100 shadow-sm">
                            <Building2 className="h-6 w-6 text-teal-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                    {org.name}
                                </h1>
                                <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-100 uppercase text-[10px] tracking-widest font-bold">
                                    Supplier
                                </Badge>
                            </div>
                            <p className="text-slate-500 mt-1">
                                Supplier Dashboard & Management Portal
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2 shadow-sm">
                        <Settings className="h-4 w-4" /> Organization Settings
                    </Button>
                    <UploadQuestionnaireDialog fiOrgId={org.id}>
                        <Button className="bg-teal-600 hover:bg-teal-700 shadow-sm gap-2">
                            <Plus className="h-4 w-4" /> New Questionnaire
                        </Button>
                    </UploadQuestionnaireDialog>
                </div>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
            >
                <div className="flex items-center justify-between border-b border-slate-200 mb-6">
                    <TabsList className="bg-transparent h-12 p-0 flex gap-8">
                        <TabsTrigger
                            value="overview"
                            className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent rounded-none px-1 h-12 font-semibold text-slate-500 data-[state=active]:text-teal-700 transition-all gap-2"
                        >
                            <LayoutDashboard className="h-4 w-4" /> Overview
                        </TabsTrigger>
                        <TabsTrigger
                            value="workbench"
                            className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent rounded-none px-1 h-12 font-semibold text-slate-500 data-[state=active]:text-teal-700 transition-all gap-2"
                        >
                            <KanbanSquare className="h-4 w-4" /> Workbench
                        </TabsTrigger>
                        <TabsTrigger
                            value="questionnaires"
                            className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent rounded-none px-1 h-12 font-semibold text-slate-500 data-[state=active]:text-teal-700 transition-all gap-2"
                        >
                            <FileText className="h-4 w-4" /> Questionnaires
                        </TabsTrigger>
                        <TabsTrigger
                            value="team"
                            className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent rounded-none px-1 h-12 font-semibold text-slate-500 data-[state=active]:text-teal-700 transition-all gap-2"
                        >
                            <Users className="h-4 w-4" /> Team
                        </TabsTrigger>
                    </TabsList>

                    <div className="hidden lg:flex items-center gap-4 py-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                            <Clock className="h-3 w-3" /> Last sync {format(new Date(), "HH:mm")}
                        </div>
                    </div>
                </div>

                <TabsContent value="overview" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden relative group">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active Relationships</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-slate-900">{engagements.length}</div>
                                <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold mt-1">
                                    <ArrowUpRight className="h-3 w-3" /> +2 this month
                                </div>
                            </CardContent>
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                                <LayoutDashboard className="h-5 w-5" />
                            </div>
                        </Card>

                        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden relative group">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">Open Queries</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-slate-900">{stats?.queries || 0}</div>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Requires Attention</p>
                            </CardContent>
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                        </Card>

                        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden relative group">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg. Completion</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-slate-900">72%</div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-teal-500 w-[72%]" />
                                </div>
                            </CardContent>
                            <div className="absolute top-4 right-4 h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        </Card>
                    </div>

                    {/* Relationships List */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">
                                Client Relationships
                            </h2>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input placeholder="Search clients..." className="pl-9 h-9 bg-white border-slate-200 shadow-none focus-visible:ring-teal-500" />
                            </div>
                        </div>

                        {engagements.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="p-4 bg-white rounded-full shadow-sm">
                                        <Building2 className="h-8 w-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900">No active relationships</h3>
                                    <p className="text-slate-500 max-w-sm">
                                        You don't have any active engagements with Legal Entities yet.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {engagements.map((engagement) => {
                                    const le = engagement.clientLE;
                                    const ownerOrg = le.owners?.[0]?.party;

                                    return (
                                        <Link key={engagement.id} href={`/app/s/${org.id}/engagements/${engagement.id}`} className="block group">
                                            <Card className="border-slate-200 shadow-sm group-hover:shadow-md group-hover:border-teal-200 transition-all cursor-pointer bg-white">
                                                <CardContent className="p-5 flex items-center gap-6">
                                                    <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors shrink-0">
                                                        <Building2 className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-teal-700 transition-colors truncate">
                                                                {le.name}
                                                            </h3>
                                                            {engagement.status && (
                                                                <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-100 uppercase tracking-tighter">
                                                                    {engagement.status}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-medium text-slate-400">Client:</span> {ownerOrg?.name || "Unknown"}
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-medium text-slate-400">Jurisdiction:</span> {le.jurisdiction || 'Unknown'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-8 text-right hidden lg:flex">
                                                        <div>
                                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Progress</div>
                                                            <div className="text-sm font-bold text-slate-900">65%</div>
                                                        </div>
                                                        <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-teal-500 transition-colors shrink-0" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="workbench" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <FIWorkbench orgId={org.id} data={workbenchData} />
                </TabsContent>

                <TabsContent value="questionnaires" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold">Standard Questionnaires</CardTitle>
                                    <CardDescription>Manage your internal templates and draft forms.</CardDescription>
                                </div>
                                <UploadQuestionnaireDialog fiOrgId={org.id}>
                                    <Button size="sm" className="gap-2">
                                        <Plus className="h-4 w-4" /> Upload Template
                                    </Button>
                                </UploadQuestionnaireDialog>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {questionnaires.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 italic">
                                    No templates uploaded yet.
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b">
                                        <tr>
                                            <th className="px-6 py-3 font-bold">Name</th>
                                            <th className="px-6 py-3 font-bold">Status</th>
                                            <th className="px-6 py-3 font-bold text-right">Last Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {questionnaires.map(q => (
                                            <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900">{q.name}</td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500 border-slate-200">
                                                        {q.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right text-xs text-slate-500 font-mono">
                                                    {format(new Date(q.updatedAt), "dd MMM yyyy")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="team" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold">Team Members</CardTitle>
                                    <CardDescription>Manage access for your organization.</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" className="gap-2 shadow-sm">
                                    <Plus className="h-4 w-4" /> Invite Member
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b">
                                    <tr>
                                        <th className="px-6 py-3 font-bold">User</th>
                                        <th className="px-6 py-3 font-bold">Role</th>
                                        <th className="px-6 py-3 font-bold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {teamMembers.map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
                                                        {m.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 text-sm">{m.name}</div>
                                                        <div className="text-xs text-slate-500">{m.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500 border-slate-200">
                                                    {m.role.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                                                    Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
