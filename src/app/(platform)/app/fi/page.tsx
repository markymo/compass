
import {
    getFIOganization,
    getFIDashboardStats,
    getFIEngagements,
    getFIQueries,
    getFIQuestionnaires
} from "@/actions/fi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard, Users, MessageSquare, Files,
    ArrowRight, Plus, Search, Filter,
    Clock, CheckCircle2, AlertCircle, Building2,
    MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import { UploadQuestionnaireDialog } from "@/components/fi/upload-questionnaire-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function FIDashboard() {
    const org = await getFIOganization();
    const stats = await getFIDashboardStats();
    const engagements = await getFIEngagements();
    const queries = await getFIQueries();
    const questionnaires = await getFIQuestionnaires();

    if (!org) return <div>Unauthorized</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compliance Cockpit</h1>
                    <p className="text-slate-500">Welcome back, {org.name}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Users className="h-4 w-4" /> Invite Client
                    </Button>
                    <UploadQuestionnaireDialog isAdmin={true}>
                        <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                            <Plus className="h-4 w-4" /> New Questionnaire
                        </Button>
                    </UploadQuestionnaireDialog>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Active Engagements</CardTitle>
                        <Users className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats?.engagements || 0}</div>
                        <p className="text-xs text-slate-500 mt-1">Clients currently onboarding</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm" style={{ borderColor: (stats?.queries || 0) > 0 ? '#fcd34d' : '' }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Open Queries</CardTitle>
                        <MessageSquare className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats?.queries || 0}</div>
                        <p className="text-xs text-slate-500 mt-1">Questions from clients</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Published Questionnaires</CardTitle>
                        <Files className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats?.questionnaires || 0}</div>
                        <p className="text-xs text-slate-500 mt-1">Available in library</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Interface Tabs */}
            <Tabs defaultValue="engagements" className="space-y-6">
                <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
                    <TabsTrigger value="engagements" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Users className="h-4 w-4" /> Engagements
                    </TabsTrigger>
                    <TabsTrigger value="inbox" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <MessageSquare className="h-4 w-4" /> Query Inbox
                        {(stats?.queries || 0) > 0 && (
                            <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats?.queries}</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="library" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Files className="h-4 w-4" /> Questionnaire Library
                    </TabsTrigger>
                </TabsList>

                {/* 1. Engagements Tab */}
                <TabsContent value="engagements" className="space-y-4">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3 border-b bg-slate-50/50 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-semibold">Client Engagements</CardTitle>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            placeholder="Search clients..."
                                            className="h-9 w-64 pl-9 pr-4 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        />
                                    </div>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Filter className="h-3.5 w-3.5" /> Filter
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {engagements.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">No active engagements found.</div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Client Entity</th>
                                            <th className="px-6 py-3 font-medium">Status</th>
                                            <th className="px-6 py-3 font-medium">Assigned Questionnaires</th>
                                            <th className="px-6 py-3 font-medium text-right">Last Activity</th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {engagements.map(eng => (
                                            <tr key={eng.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                                                            <Building2 className="h-4 w-4" />
                                                        </div>
                                                        {eng.clientLE.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={eng.status === 'SIGNED_OFF' ? 'default' : 'secondary'} className={
                                                        eng.status === 'QUERIES_OPEN' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : ''
                                                    }>
                                                        {eng.status.replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {eng.questionnaires.length > 0 ? (
                                                        <span className="truncate max-w-[200px] block" title={eng.questionnaires.map(q => q.name).join(", ")}>
                                                            {eng.questionnaires[0].name}
                                                            {eng.questionnaires.length > 1 && <span className="text-xs text-slate-400 ml-1">+{eng.questionnaires.length - 1} more</span>}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">None assigned</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-500">
                                                    {/* Placeholder for now as we removed sort */}
                                                    2 hours ago
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Review <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 2. Queries Inbox Tab */}
                <TabsContent value="inbox" className="space-y-4">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3 border-b bg-slate-50/50 rounded-t-xl">
                            <CardTitle className="text-lg font-semibold">Active Queries</CardTitle>
                            <CardDescription>Questions from clients requiring your attention</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {queries.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                    <CheckCircle2 className="h-12 w-12 text-slate-200 mb-4" />
                                    <p className="font-medium">All caught up!</p>
                                    <p className="text-sm">No open queries at the moment.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {queries.map(q => (
                                        <div key={q.id} className="p-6 hover:bg-slate-50 transition-colors flex gap-4 items-start cursor-pointer">
                                            <div className="mt-1">
                                                <div className="h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {q.engagement.clientLE.name}
                                                    </p>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(q.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-900 font-medium">{q.question}</p>
                                                <div className="text-sm text-slate-500 bg-slate-100 p-3 rounded-md mt-2 border border-slate-200">
                                                    <span className="text-xs font-bold text-slate-400 block mb-1">CONTEXT (FIELD: {q.fieldKey})</span>
                                                    "{q.answer || "No answer provided yet..."}"
                                                </div>
                                            </div>
                                            <Button size="sm" variant="outline">Reply</Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 3. Library Tab */}
                <TabsContent value="library">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-slate-50/50 rounded-t-xl">
                            <div>
                                <CardTitle className="text-lg font-semibold">Uploaded Forms</CardTitle>
                                <CardDescription>Manage your uploaded forms and check mapping status.</CardDescription>
                            </div>
                            <UploadQuestionnaireDialog isAdmin={true}>
                                <Button size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" /> Upload New
                                </Button>
                            </UploadQuestionnaireDialog>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6">Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Mapping Status</TableHead>
                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {questionnaires.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                No questionnaires uploaded yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        questionnaires.map((q) => (
                                            <TableRow key={q.id} className="hover:bg-slate-50/50">
                                                <TableCell className="pl-6 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Files className="h-4 w-4 text-blue-500" />
                                                        <span title={q.name} className="truncate max-w-[300px] block">{q.name}</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground ml-6 truncate max-w-[300px]">{q.fileName}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={q.status === "ACTIVE" ? "default" : "secondary"}>
                                                        {q.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {(q as any).mappings ? (
                                                            <>
                                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                <span className="text-sm">Mapped</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Clock className="h-4 w-4 text-amber-500" />
                                                                <span className="text-sm">Pending Mapping</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={`/app/admin/questionnaires/${q.id}`}>
                                                            <Button size="sm" variant="ghost">
                                                                Manage <ArrowRight className="ml-2 h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <span className="text-xs text-muted-foreground flex items-center px-3">
                                                            {new Date(q.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
