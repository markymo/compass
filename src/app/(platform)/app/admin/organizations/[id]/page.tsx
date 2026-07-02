"use client";

import { useState, useEffect, useRef } from "react";
import { getOrganizationDetails, updateOrganization, archiveOrganization, unarchiveOrganization } from "@/actions/org";
import { inviteUser, getPendingInvitations } from "@/actions/invitations";
import { createLegalEntity } from "@/actions/client-le";
import { getQuestionnaires, createQuestionnaire, startBackgroundExtraction } from "@/actions/questionnaire";
import { UserAccessModal, UserAccessRow } from "./UserAccessModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, UserPlus, Mail, FileText, Upload, Plus, Pen, Check, X, Trash2, ArchiveRestore, Clock, Building, CheckCircle2, AlertCircle, Shield, Eye } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ConfirmArchiveDialog } from "@/components/shared/confirm-dialogs";

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
    const [inviteRole, setInviteRole] = useState("ORG_MEMBER");
    const [inviting, setInviting] = useState(false);
    
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    // Modal State
    const [selectedUser, setSelectedUser] = useState<UserAccessRow | null>(null);

    // LE Creation State
    const [leName, setLeName] = useState("");
    const [leJurisdiction, setLeJurisdiction] = useState("");
    const [creatingLe, setCreatingLe] = useState(false);

    // Tab State: "overview" | "members" | "entities" | "questionnaires"
    const [activeTab, setActiveTab] = useState("overview");
    const [uploading, setUploading] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");

    // Archive / Unarchive State
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [unarchiveOpen, setUnarchiveOpen] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    async function handleSaveName() {
        if (!org || !editName.trim()) return;
        const res = await updateOrganization(org.id, { name: editName });
        if (res.success) {
            toast.success("Organization name updated");
            setOrg({ ...org, name: editName }); // Optimistic / Local update
            setIsEditing(false);
            loadData(org.id); // Refresh
        } else {
            toast.error("Update failed: " + res.error);
        }
    }

    useEffect(() => {
        params.then(setUnwrappedParams);
    }, [params]);

    useEffect(() => {
        if (unwrappedParams) loadData(unwrappedParams.id);
    }, [unwrappedParams]);

    async function loadData(id: string) {
        // Only show full loading spinner on initial load, not polling
        if (!org) setLoading(true);
        const [orgData, qData, invitesData] = await Promise.all([
            getOrganizationDetails(id),
            getQuestionnaires(id),
            getPendingInvitations(id)
        ]);
        setOrg(orgData);
        setQuestionnaires(qData);
        setPendingInvites(invitesData);
        setLoading(false);
    }

    // Polling for Digitization Progress
    useEffect(() => {
        if (!unwrappedParams?.id) return;

        const hasProcessing = questionnaires.some((q: any) => q.status === "DIGITIZING");
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            loadData(unwrappedParams.id);
        }, 2000);

        return () => clearInterval(interval);
    }, [questionnaires, unwrappedParams]);

    async function handleAddMember() {
        if (!inviteEmail || !org) return;
        setInviting(true);
        try {
            const res = await inviteUser({ email: inviteEmail, role: inviteRole, organizationId: org.id });
            if (res.success) {
                toast.success(`Invited ${inviteEmail} as ${inviteRole}`);
                setInviteEmail("");
                setInviteRole("ORG_MEMBER");
                loadData(org.id);
            } else {
                toast.error("Error: " + (res.error || "Failed to invite user"));
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setInviting(false);
        }
    }

    async function handleCreateLE(e: React.FormEvent) {
        e.preventDefault();
        if (!leName || !org) return;
        setCreatingLe(true);
        try {
            const res = await createLegalEntity({ name: leName, jurisdiction: leJurisdiction, clientOrgId: org.id });
            if (res.success) {
                toast.success("Legal Entity created successfully");
                setLeName("");
                setLeJurisdiction("");
                loadData(org.id);
            } else {
                toast.error("Error: " + (res.error || "Failed to create LE"));
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setCreatingLe(false);
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
    const displayedQuestionnaires = questionnaires.filter((q: any) => showArchived ? true : q.status !== "ARCHIVED");

    // Capability Flags
    const isClient = org.types.includes("CLIENT");
    const isSupplier = org.types.some((t: string) => ["FI", "SUPPLIER", "LAW_FIRM"].includes(t));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/app/admin/organizations">
                    <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                </Link>




                <div>
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="text-2xl font-bold h-10 w-96"
                            />
                            <Button size="icon" variant="ghost" onClick={handleSaveName}>
                                <Check className="w-5 h-5 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
                                <X className="w-5 h-5 text-slate-400" />
                            </Button>
                        </div>
                    ) : (
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 group">
                            {org.name}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                                onClick={() => { setEditName(org.name); setIsEditing(true); }}
                            >
                                <Pen className="w-3 h-3 text-slate-400" />
                            </Button>
                            {org.types.map((t: string) => (
                                <Badge key={t} variant="secondary">{t}</Badge>
                            ))}
                            {org.status === "ARCHIVED" && (
                                <Badge variant="destructive">ARCHIVED</Badge>
                            )}
                        </h1>
                    )}
                    <p className="text-muted-foreground text-sm">ID: {org.id}</p>
                </div>

                <div className="ml-auto">
                    {org.status === "ARCHIVED" ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setUnarchiveOpen(true)}
                            >
                                <ArchiveRestore className="w-4 h-4 mr-2" />
                                Unarchive Organization
                            </Button>
                            <ConfirmArchiveDialog
                                open={unarchiveOpen}
                                onOpenChange={setUnarchiveOpen}
                                title="Unarchive Organization?"
                                description="Are you sure you want to unarchive this organization? All associated Legal Entities will also be unarchived."
                                isLoading={isArchiving}
                                onConfirm={async () => {
                                    setIsArchiving(true);
                                    await unarchiveOrganization(org.id);
                                    await loadData(org.id);
                                    toast.success("Organization Unarchived");
                                    setIsArchiving(false);
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setArchiveOpen(true)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Archive Organization
                            </Button>
                            <ConfirmArchiveDialog
                                open={archiveOpen}
                                onOpenChange={setArchiveOpen}
                                title="Archive Organization?"
                                description="Are you sure you want to archive this organization? All associated Legal Entities will also be archived and hidden from primary workflows."
                                isLoading={isArchiving}
                                onConfirm={async () => {
                                    setIsArchiving(true);
                                    await archiveOrganization(org.id);
                                    await loadData(org.id);
                                    toast.success("Organization Archived");
                                    setIsArchiving(false);
                                }}
                            />
                        </>
                    )}
                </div>
            </div>



            {/* Custom Tabs */}
            <div className="border-b">
                <nav className="flex items-center gap-4">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "overview" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                        Setup & Overview
                    </button>
                    <button
                        onClick={() => setActiveTab("members")}
                        className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "members" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                        Members
                    </button>
                    {org.types.includes("CLIENT") && (
                        <button
                            onClick={() => setActiveTab("entities")}
                            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "entities" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            Client Legal Entities
                        </button>
                    )}
                    {org.types.some((t: string) => ["FI", "SUPPLIER", "LAW_FIRM"].includes(t)) && (
                        <button
                            onClick={() => setActiveTab("relationships")}
                            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === "relationships" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            Relationships
                        </button>
                    )}
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
                {activeTab === "overview" && (
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Onboarding Health</CardTitle>
                                <CardDescription>Checklist for organization readiness.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        <span className="text-sm font-medium">Organization Created</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {org.memberships?.some((m: any) => m.role === "ORG_ADMIN") ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-amber-500" />
                                        )}
                                        <span className="text-sm font-medium">At least one ORG_ADMIN</span>
                                    </div>
                                </div>

                                {isClient && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <h4 className="text-sm font-semibold text-slate-900">Client setup</h4>
                                        <div className="flex items-center gap-3">
                                            {org.ownedLEs?.length > 0 ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                            )}
                                            <span className="text-sm font-medium">At least one Client Legal Entity</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {org.memberships?.some((m: any) => m.role === "ORG_ADMIN") || pendingInvites.some((inv: any) => inv.role === "ORG_ADMIN") ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                            )}
                                            <span className="text-sm font-medium">Admin invited or active</span>
                                        </div>
                                    </div>
                                )}

                                {isSupplier && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <h4 className="text-sm font-semibold text-slate-900">Supplier setup</h4>
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="w-5 h-5 text-slate-300" />
                                            <span className="text-sm font-medium text-slate-600">Questionnaire library configured <span className="font-normal italic text-slate-400">— Not checked yet</span></span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {org.engagements?.length > 0 ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                            )}
                                            <span className="text-sm font-medium">Assigned to at least one relationship</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Statistics</CardTitle>
                                <CardDescription>Current snapshot of the organization.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="text-sm text-muted-foreground">Client Legal Entities</span>
                                    <span className="font-semibold">{org.ownedLEs?.length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="text-sm text-muted-foreground">Active Users</span>
                                    <span className="font-semibold">{org.memberships?.length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center pb-2">
                                    <span className="text-sm text-muted-foreground">Pending Invites</span>
                                    <span className="font-semibold">{pendingInvites.length}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "members" && (
                    <div className="space-y-6">
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
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
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
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                                                        <Check className="h-3 w-3" />
                                                        Active
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedUser({
                                                        kind: "membership",
                                                        id: m.id,
                                                        email: m.user.email,
                                                        role: m.role as any,
                                                        status: "ACTIVE",
                                                        scopeType: "ORG",
                                                        scopeId: org.id,
                                                        scopeName: org.name
                                                    })}>
                                                        Manage
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {pendingInvites.map((inv: any) => (
                                            <TableRow key={inv.id} className="bg-slate-50/40">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-slate-400" />
                                                        <div>
                                                            <div className="font-medium text-slate-700 italic">Pending Invite</div>
                                                            <div className="text-xs text-slate-500">{inv.sentToEmail}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="opacity-70">{inv.role}</Badge>
                                                    {inv.clientLEId && (
                                                        <div className="text-[10px] text-slate-500 mt-1">LE: {inv.clientLE?.name || inv.clientLEId}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full w-fit">
                                                        <Clock className="h-3 w-3" />
                                                        Pending
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => setSelectedUser({
                                                        kind: "invitation",
                                                        id: inv.id,
                                                        email: inv.sentToEmail,
                                                        role: inv.role as any,
                                                        status: "PENDING",
                                                        scopeType: "ORG",
                                                        scopeId: org.id,
                                                        scopeName: org.name
                                                    })}>
                                                        Manage
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {org.memberships.length === 0 && pendingInvites.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                    No members or pending invitations found.
                                                </TableCell>
                                            </TableRow>
                                        )}
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
                                <div className="space-y-3">
                                    <Input
                                        placeholder="user@example.com"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        required
                                    />
                                    <Select value={inviteRole} onValueChange={setInviteRole}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ORG_MEMBER">Member (Limited access)</SelectItem>
                                            <SelectItem value="ORG_ADMIN">Admin (Full control)</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                    
                    {/* ROLES HELP PANEL */}
                    <Card className="bg-slate-50/50">
                        <CardHeader>
                            <CardTitle className="text-base text-slate-800">Roles & Permissions</CardTitle>
                            <CardDescription>What each role can do in this organization</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 text-sm text-muted-foreground">
                            <div className="pb-4 border-b border-slate-200">
                                <div className="flex gap-2">
                                    <span className="font-semibold text-slate-800">Tip:</span>
                                    <p className="font-medium text-slate-700">
                                        Most day-to-day work happens at the Legal Entity level (LE roles), not at the organization level.{" "}
                                        <button onClick={() => setActiveTab("entities")} className="text-primary hover:underline font-semibold">
                                            Go to Legal Entities tab
                                        </button>
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* ORG_ADMIN */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-slate-800">
                                        <Shield className="w-4 h-4" />
                                        <div className="font-semibold">ORG_ADMIN (Admin)</div>
                                    </div>
                                    <p className="text-slate-600">
                                        Full control over this organization. Responsible for managing users, legal entities, and overall platform usage.
                                    </p>
                                    
                                    <div className="space-y-2">
                                        <div className="font-medium text-slate-700">What this means in practice:</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                            <li><span className="font-medium text-slate-700">For Client organizations:</span> manages Legal Entities, onboarding, and data completion</li>
                                            <li><span className="font-medium text-slate-700">For Supplier organizations:</span> manages teams, questionnaires, and engagement workflows</li>
                                        </ul>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="font-medium text-slate-700">Capabilities:</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                            <li>Create and manage Legal Entities (where applicable)</li>
                                            <li>Invite and manage users</li>
                                            <li>View organization activity and data</li>
                                            <li>Perform sign-off actions</li>
                                        </ul>
                                    </div>
                                </div>
                                
                                {/* ORG_MEMBER */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-slate-800">
                                        <Eye className="w-4 h-4" />
                                        <div className="font-semibold">ORG_MEMBER (Member)</div>
                                    </div>
                                    <p className="text-slate-600">
                                        Limited access role for stakeholders who need visibility but are not responsible for managing data or workflows.
                                    </p>
                                    
                                    <div className="space-y-2">
                                        <div className="font-medium text-slate-700">What this means in practice:</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                            <li><span className="font-medium text-slate-700">For Client organizations:</span> can see onboarding progress and entity activity</li>
                                            <li><span className="font-medium text-slate-700">For Supplier organizations:</span> can see engagement activity at a high level</li>
                                        </ul>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="font-medium text-slate-700">Capabilities:</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                            <li>View organization-level activity</li>
                                            <li>See high-level engagement information</li>
                                            <li>Cannot manage users or edit data</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

                {activeTab === "relationships" && org.types.some((t: string) => ["FI", "SUPPLIER", "LAW_FIRM"].includes(t)) && (
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Relationships</CardTitle>
                                <CardDescription>Client relationships and engagements where this organization acts as a supplier.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-md border border-slate-100 mb-4">
                                    <p className="font-medium text-slate-700 mb-2">Supplier-side relationships (Engagements)</p>
                                    <p>As a supplier, this organization interacts with Legal Entities via relationships (engagements), but does not own them. Legal Entities will only be shown within the context of a relationship, not as owned entities.</p>
                                </div>
                                
                                {org.engagements && org.engagements.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Client Legal Entity</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {org.engagements.map((eng: any) => (
                                                <TableRow key={eng.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Building className="w-4 h-4 text-muted-foreground" />
                                                            <span className="font-medium">{eng.clientLE?.name || "Unknown"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{eng.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" disabled>
                                                            View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center p-8 text-slate-500">
                                        No active relationships found.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "entities" && org.types.includes("CLIENT") && (
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Client Legal Entities</CardTitle>
                                <CardDescription>Legal Entities owned by this organization in its client capacity.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Jurisdiction</TableHead>
                                            <TableHead>LEI</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {org.ownedLEs?.map((ownerRecord: any) => {
                                            const le = ownerRecord.clientLE;
                                            return (
                                                <TableRow key={le.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Building className="w-4 h-4 text-muted-foreground" />
                                                            <span className="font-medium">{le.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{le.jurisdiction || "-"}</TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{le.legalEntity?.lei || "-"}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={le.status === "ACTIVE" ? "default" : "secondary"}>{le.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href={`/app/le/${le.id}`}>
                                                            <Button variant="outline" size="sm">Manage LE</Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {(!org.ownedLEs || org.ownedLEs.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    No Legal Entities found. Create one to get started.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Create Legal Entity</CardTitle>
                                <CardDescription>Add a new legal entity for this client.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleCreateLE} className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">Name</label>
                                            <Input
                                                placeholder="e.g. Acme UK Ltd"
                                                value={leName}
                                                onChange={e => setLeName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">Jurisdiction</label>
                                            <Input
                                                placeholder="e.g. GB"
                                                value={leJurisdiction}
                                                onChange={e => setLeJurisdiction(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <Button className="w-full" type="submit" disabled={creatingLe}>
                                        {creatingLe ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                        Create LE
                                    </Button>
                                </form>
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

            <UserAccessModal 
                open={!!selectedUser} 
                onOpenChange={(open) => !open && setSelectedUser(null)} 
                user={selectedUser} 
                onSuccess={() => {
                    if (org) loadData(org.id);
                    // Keep modal open, but we could close it if we want.
                }} 
            />
        </div>
    );
}
