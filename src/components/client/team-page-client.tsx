"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Mail, Shield, User, Clock, Trash2, Check } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { InviteMemberDialog } from "./invite-member-dialog";
import { revokeInvitation } from "@/actions/invitations";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { updateUserPermission } from "@/actions/memberships";

interface TeamPageProps {
    params: { clientId: string };
    users: any[];     // Active users
    invites: any[];   // Pending invites
    canManage: boolean;
    orgName: string;
    allClientLEs: any[]; // NEW: For Matrix
}

export default function ClientTeamPage({
    users = [],
    invites = [],
    clientId,
    canManage,
    orgName,
    allClientLEs = []
}: any) {
    console.log("[ClientTeamPage] Received users:", users.length, "LEs:", allClientLEs.length);
    const router = useRouter();
    const [isRevoking, setIsRevoking] = useState<string | null>(null);

    async function handleRevoke(inviteId: string) {
        if (!confirm("Are you sure you want to revoke this invitation?")) return;
        setIsRevoking(inviteId);
        await revokeInvitation(inviteId);
        setIsRevoking(null);
        router.refresh();
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50">
            <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <Link href={`/app/clients/${clientId}`} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2">
                            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
                        <p className="text-slate-500">Manage users and permissions for {orgName}</p>
                    </div>
                    {canManage && (
                        <InviteMemberDialog orgId={clientId} />
                    )}
                </div>

                <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="active">Active Members ({users.length})</TabsTrigger>
                        <TabsTrigger value="pending">Pending Invitations ({invites.length})</TabsTrigger>
                    </TabsList>

                    {/* Active Members Content */}
                    <TabsContent value="active" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Team Permissions Matrix</CardTitle>
                                <CardDescription>Manage access across the organization and specific legal entities.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {users.map((u: any) => (
                                        <UserPermissionRow
                                            key={u.id}
                                            user={u}
                                            allClientLEs={allClientLEs}
                                            canManage={canManage}
                                            clientId={clientId}
                                        />
                                    ))}
                                    {users.length === 0 && (
                                        <div className="text-center py-8 text-slate-500 italic">No active members found.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Pending Invites Content */}
                    <TabsContent value="pending" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Invitations</CardTitle>
                                <CardDescription>Invitations sent but not yet accepted.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {invites.map((group: any) => (
                                        <div key={group.email} className="p-4 border rounded-lg bg-white border-dashed">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Mail className="h-4 w-4 text-slate-400" />
                                                <p className="font-medium text-slate-900">{group.email}</p>
                                            </div>

                                            <div className="space-y-2 pl-6 border-l-2 border-slate-100 ml-2">
                                                {group.items.map((inv: any) => (
                                                    <div key={inv.id} className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px]">{inv.role}</Badge>
                                                            {inv.clientLE ? (
                                                                <span className="flex items-center gap-1 text-amber-600 text-xs">
                                                                    <Shield className="h-3 w-3" />
                                                                    {inv.clientLE.name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500 text-xs">Organization Wide</span>
                                                            )}
                                                            <span className="text-xs text-slate-400">• {format(new Date(inv.createdAt), 'MMM d')}</span>
                                                        </div>

                                                        {canManage && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs px-2"
                                                                onClick={() => handleRevoke(inv.id)}
                                                                disabled={isRevoking === inv.id}
                                                            >
                                                                {isRevoking === inv.id ? "..." : "Revoke"}
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {invites.length === 0 && (
                                        <div className="text-center py-8 text-slate-500 italic">No pending invitations.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

function UserPermissionRow({ user, allClientLEs, canManage, clientId }: { user: any, allClientLEs: any[], canManage: boolean, clientId: string }) {
    // Top Level Org Admin State
    const orgMembership = user.memberships.find((m: any) => m.role === "ORG_ADMIN" && m.scopeType === "ORG");
    const isOrgAdmin = !!orgMembership;

    function getLeRole(leId: string) {
        const m = user.memberships.find((m: any) => m.scopeType === "LE" && m.scopeId === leId);
        return m?.role;
    }

    async function toggleOrgAdmin(checked: boolean) {
        if (!canManage) return;

        const res = await updateUserPermission({
            targetUserId: user.id,
            scopeType: "ORG",
            scopeId: clientId,
            role: checked ? "ORG_ADMIN" : "NONE"
        });

        if (!res.success) {
            alert(res.error);
        }
    }

    async function toggleLeRole(leId: string, newRole: "LE_ADMIN" | "LE_USER", checked: boolean) {
        if (!canManage) return;

        let roleToSend: "LE_ADMIN" | "LE_USER" | "NONE" = "NONE";
        if (checked) roleToSend = newRole;

        const res = await updateUserPermission({
            targetUserId: user.id,
            scopeType: "LE",
            scopeId: leId,
            role: roleToSend
        });

        if (!res.success) {
            alert(res.error);
        }
    }

    return (
        <div className="border rounded-lg bg-white overflow-hidden shadow-sm transition-all hover:shadow-md">
            {/* Top Level User Row */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border-b">
                <div className="flex items-center gap-4">
                    <Avatar>
                        <AvatarFallback className="bg-slate-200">{user.email.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-slate-900">{user.email}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 mr-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={`org-admin-${user.id}`}
                            checked={isOrgAdmin}
                            disabled={!canManage}
                            onCheckedChange={(c: boolean | "indeterminate") => toggleOrgAdmin(!!c)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <label
                            htmlFor={`org-admin-${user.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                            Client Admin
                        </label>
                    </div>
                </div>
            </div>

            {/* Matrix Content */}
            <div className="p-4 bg-white">
                <div className="grid grid-cols-[1fr_150px_150px] gap-4 mb-2 border-b pb-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Legal Entity</div>
                    <div className="text-xs font-semibold text-slate-500 uppercase text-center tracking-wider">LE Admin</div>
                    <div className="text-xs font-semibold text-slate-500 uppercase text-center tracking-wider">LE User</div>
                </div>

                <div className="space-y-1">
                    {allClientLEs.map(le => {
                        const currentRole = getLeRole(le.id);
                        const isLeAdmin = currentRole === "LE_ADMIN";
                        const isLeUser = currentRole === "LE_USER";

                        return (
                            <div key={le.id} className="grid grid-cols-[1fr_150px_150px] gap-4 items-center hover:bg-slate-50 p-2 rounded-md transition-colors">
                                <div className="text-sm font-medium text-slate-700">{le.name}</div>

                                <div className="flex justify-center">
                                    <Checkbox
                                        checked={isLeAdmin}
                                        disabled={!canManage}
                                        onCheckedChange={(c: boolean | "indeterminate") => toggleLeRole(le.id, "LE_ADMIN", !!c)}
                                        className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                    />
                                </div>

                                <div className="flex justify-center">
                                    <Checkbox
                                        checked={isLeUser}
                                        disabled={!canManage}
                                        onCheckedChange={(c: boolean | "indeterminate") => toggleLeRole(le.id, "LE_USER", !!c)}
                                        className="data-[state=checked]:bg-slate-500 data-[state=checked]:border-slate-500"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
