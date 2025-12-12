"use client";

import { useState, useEffect, use } from "react";
import { getOrganizationDetails, addMemberToOrg } from "@/actions/org";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, UserPlus, Mail, Shield } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Next.js 15+ params are async
    const [unwrappedParams, setUnwrappedParams] = useState<{ id: string } | null>(null);
    const [org, setOrg] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        params.then(setUnwrappedParams);
    }, [params]);

    useEffect(() => {
        if (unwrappedParams) loadData(unwrappedParams.id);
    }, [unwrappedParams]);

    async function loadData(id: string) {
        setLoading(true);
        const data = await getOrganizationDetails(id);
        setOrg(data);
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
                        <p className="text-xs text-muted-foreground mt-2">
                            Note: If the user exists, they will be moved to this organization. If not, a placeholder account is created.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
