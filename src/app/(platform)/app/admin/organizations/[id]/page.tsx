"use client";

import { useState, useEffect, useRef } from "react";
import { getOrganizationDetails, addMemberToOrg } from "@/actions/org";
import { getQuestionnaires, createQuestionnaire, startBackgroundExtraction } from "@/actions/questionnaire";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, UserPlus, Mail, FileText, Upload, Plus } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// Helper for Logs
function LogViewer({ logs }: { logs: any }) {
    // Ensure logs is an array
    let safeLogs = logs;
    if (typeof logs === 'string') {
        try { safeLogs = JSON.parse(logs); } catch (e) { safeLogs = []; }
    }
    if (!Array.isArray(safeLogs)) safeLogs = [];

    console.log("LogViewer rendering:", logs, "Safe:", safeLogs);

    if (safeLogs.length === 0) return <div className="text-xs text-slate-400 p-2">No logs available.</div>;

    return (
        <ScrollArea className="h-64 w-full rounded border bg-slate-950 p-2 text-xs font-mono">
            {safeLogs.map((log: any, i: number) => (
                <div key={i} className="mb-1 flex gap-2">
                    <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={
                        log.level === 'ERROR' ? 'text-red-400 font-bold' :
                            log.level === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-300'
                    }>
                        {log.message}
                    </span>
                </div>
            ))}
        </ScrollArea>
    );
}

export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const [unwrappedParams, setUnwrappedParams] = useState<{ id: string } | null>(null);
    const [org, setOrg] = useState<any>(null);
    const [questionnaires, setQuestionnaires] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);

    // Tab State: "members" | "questionnaires"
    const [activeTab, setActiveTab] = useState("members");
    const [uploading, setUploading] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        params.then(setUnwrappedParams);
    }, [params]);

    useEffect(() => {
        if (unwrappedParams) loadData(unwrappedParams.id);
    }, [unwrappedParams]);

    async function loadData(id: string) {
        // Only show full loading spinner on initial load, not polling
        if (!org) setLoading(true);
        const [orgData, qData] = await Promise.all([
            getOrganizationDetails(id),
            getQuestionnaires(id)
        ]);
        setOrg(orgData);
        setQuestionnaires(qData);
        setLoading(false);
    }

    // Polling for Digitization Progress
    useEffect(() => {
        if (!unwrappedParams?.id) return;

        const hasProcessing = questionnaires.some(q => q.status === "DIGITIZING");
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            loadData(unwrappedParams.id);
        }, 2000);

        return () => clearInterval(interval);
    }, [questionnaires, unwrappedParams]);

    async function handleAddMember() {
        if (!inviteEmail || !org) return;
        setInviting(true);
        const res = await addMemberToOrg(org.id, inviteEmail);
        setInviting(false);
        if (res.success) {
            setInviteEmail("");
            loadData(org.id);
        } else {
            alert("Error: " + res.error);
        }
    }

    async function handleDirectUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !org) return;

        setUploading(true);
        toast.info("Uploading " + file.name + "...");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", "Pending"); // Default name as requested

        try {
            const res = await createQuestionnaire(org.id, formData);
            if (res.success && res.data?.id) {
                const qId = res.data.id;
                toast.success("Upload started", { description: "You can rename this later." });

                // Refresh list immediately
                loadData(org.id);

                // Background Extract
                startBackgroundExtraction(qId).then(() => {
                    toast.success("Digitization complete!");
                    loadData(org.id); // Refresh again on complete
                });

            } else {
                toast.error("Upload failed: " + res.error);
            }
        } catch (error) {
            console.error(error);
            toast.error("Upload error");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    if (!org && loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!org) return <div>Organization not found</div>;

    // Filter Questionnaires
    const displayedQuestionnaires = questionnaires.filter(q => showArchived ? true : q.status !== "ARCHIVED");

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/app/admin/organizations">
                    <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        {org.name}
                        {org.types.map((t: string) => (
                            <Badge key={t} variant="secondary">{t}</Badge>
                        ))}
                    </h1>
                    <p className="text-muted-foreground text-sm">ID: {org.id}</p>
                </div>
            </div>

            {/* Custom Tabs */}
            <div className="border-b">
                <nav className="flex items-center gap-4">
                    <button
                        onClick={() => setActiveTab("members")}
                        className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "members" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                        Members
                    </button>
                    {org.types.includes("FI") && (
                        <button
                            onClick={() => setActiveTab("questionnaires")}
                            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "questionnaires" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            Questionnaires
                        </button>
                    )}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
                {activeTab === "members" && (
                    <div className="grid gap-6 md:grid-cols-3">
                        {/* MEMBER LIST */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Members</CardTitle>
                                <CardDescription>Users with access to this organization.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {org.memberships.map((m: any) => (
                                            <TableRow key={m.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                                        <span className="font-medium">{m.user.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{m.role}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* ADD MEMBER */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Add Member</CardTitle>
                                <CardDescription>Invite a user by email.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="user@example.com"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <Button className="w-full" onClick={handleAddMember} disabled={inviting}>
                                    {inviting ? <Loader2 className="animate-spin w-4 h-4" /> : (
                                        <>
                                            <UserPlus className="w-4 h-4 mr-2" />
                                            Add Member
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "questionnaires" && (
                    <div className="grid gap-6">
                        {/* Full Width Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <CardTitle>Electronic Questionnaires</CardTitle>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept=".pdf,.docx,.doc,.txt"
                                            onChange={handleDirectUpload}
                                        />
                                        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="h-8 gap-2">
                                            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                            New Questionnaire
                                        </Button>
                                    </div>
                                    <CardDescription>Manage digitized questionnaires for this FI.</CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="showArchived"
                                        checked={showArchived}
                                        onChange={(e) => setShowArchived(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <label htmlFor="showArchived" className="text-sm text-muted-foreground cursor-pointer select-none">Show Archived</label>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>File</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedQuestionnaires.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    {questionnaires.length > 0 ? "No active questionnaires found." : "No questionnaires found. Upload one to get started."}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {displayedQuestionnaires.map((q: any) => (
                                            <TableRow key={q.id} className={q.status === "ARCHIVED" ? "opacity-50 bg-muted/50" : ""}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-blue-500" />
                                                        {q.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs font-mono">
                                                    {q.fileName || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="cursor-pointer inline-flex">
                                                                {q.status === 'DIGITIZING' ? (
                                                                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse hover:bg-indigo-100 transition-colors">
                                                                        Digitizing...
                                                                    </Badge>
                                                                ) : q.status === 'DRAFT' ? (
                                                                    <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100">
                                                                        Draft
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant={q.status === "ACTIVE" ? "default" : (q.status === "ARCHIVED" ? "destructive" : "secondary")}>
                                                                        {q.status}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[400px] p-0" align="end">
                                                            <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                                                                <h4 className="font-medium text-xs uppercase tracking-wide text-slate-500">Processing Logs</h4>
                                                                <Badge variant="outline" className="text-[10px] h-5">{q.status}</Badge>
                                                            </div>
                                                            <div className="p-0">
                                                                <LogViewer logs={q.processingLogs || []} />
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {new Date(q.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={`/app/admin/questionnaires/${q.id}`}>
                                                        <Button variant="outline" size="sm">Manage</Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
