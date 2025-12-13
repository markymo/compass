"use client";

import { useState, useEffect } from "react";
import { getOrganizationDetails, addMemberToOrg } from "@/actions/org";
import { getQuestionnaires, createQuestionnaire } from "@/actions/questionnaire";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, UserPlus, Mail, FileText, Upload, Calendar } from "lucide-react";
import Link from "next/link";

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

    useEffect(() => {
        params.then(setUnwrappedParams);
    }, [params]);

    useEffect(() => {
        if (unwrappedParams) loadData(unwrappedParams.id);
    }, [unwrappedParams]);

    async function loadData(id: string) {
        setLoading(true);
        const [orgData, qData] = await Promise.all([
            getOrganizationDetails(id),
            getQuestionnaires(id)
        ]);
        setOrg(orgData);
        setQuestionnaires(qData);
        setLoading(false);
    }

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

    async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!org) return;
        setUploading(true);

        const formData = new FormData(e.currentTarget);
        const res = await createQuestionnaire(org.id, formData);

        setUploading(false);
        if (res.success) {
            // Reset form
            (e.target as HTMLFormElement).reset();
            loadData(org.id);
        } else {
            alert("Error: " + res.error);
        }
    }

    if (!org && loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!org) return <div>Organization not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/app/admin/organizations">
                    <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        {org.name}
                        <Badge variant="secondary">{org.type}</Badge>
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
                    {org.type === "FI" && (
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
                                        {org.members.map((m: any) => (
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
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Electronic Questionnaires</CardTitle>
                                <CardDescription>Manage digitized questionnaires for this FI.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {questionnaires.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground">No questionnaires found.</TableCell>
                                            </TableRow>
                                        )}
                                        {questionnaires.map((q: any) => (
                                            <TableRow key={q.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-blue-500" />
                                                        {q.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={q.status === "ACTIVE" ? "default" : "secondary"}>{q.status}</Badge>
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

                        <Card>
                            <CardHeader>
                                <CardTitle>Upload Questionnaire</CardTitle>
                                <CardDescription>Upload a PDF or Word document.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleUpload} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Name</label>
                                        <Input name="name" placeholder="e.g. AML Questionnaire 2025" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Document</label>
                                        <Input type="file" name="file" required accept=".pdf,.docx,.doc,.txt" />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={uploading}>
                                        {uploading ? <Loader2 className="animate-spin w-4 h-4" /> : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Upload & Create
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
