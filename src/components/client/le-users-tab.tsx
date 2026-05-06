"use client";

import { useState, useEffect } from "react";
import { getLEUsers, inviteUserToLE, LEUser, removeLEMembership, updateLEMembershipRole } from "@/actions/client";
import { getLEPendingInvitations, revokeInvitation } from "@/actions/invitations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, UserPlus, Mail, Shield, CheckCircle2, Clock, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

interface LEUsersTabProps {
    leId: string;
    canManageUsers?: boolean;
}

export function LEUsersTab({ leId, canManageUsers = false }: LEUsersTabProps) {
    const [users, setUsers] = useState<LEUser[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Invite State
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("LE_USER");
    const [inviting, setInviting] = useState(false);
    
    // Modal State
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [revoking, setRevoking] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [updatingRole, setUpdatingRole] = useState(false);
    const [editedRole, setEditedRole] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
    }, [leId]);

    async function loadUsers() {
        setLoading(true);
        try {
            const [usersData, invitesData] = await Promise.all([
                getLEUsers(leId),
                getLEPendingInvitations(leId)
            ]);
            setUsers(usersData);
            setInvites(invitesData);
        } catch (error) {
            console.error("Failed to load users or invites", error);
            toast.error("Failed to load user list.");
        } finally {
            setLoading(false);
        }
    }

    async function handleRevoke() {
        if (!selectedUser || selectedUser.kind !== "invitation") return;
        setRevoking(true);
        try {
            const res = await revokeInvitation(selectedUser.id);
            if (res.success) {
                toast.success("Invitation revoked successfully.");
                setSelectedUser(null);
                loadUsers();
            } else {
                toast.error(res.error || "Failed to revoke invitation.");
            }
        } catch (e) {
            toast.error("An error occurred while revoking.");
        } finally {
            setRevoking(false);
        }
    }

    async function handleRemoveAccess() {
        if (!selectedUser || selectedUser.kind !== "membership") return;
        setRemoving(true);
        try {
            const res = await removeLEMembership(selectedUser.id);
            if (res.success) {
                toast.success("User access removed successfully.");
                setConfirmRemove(false);
                setSelectedUser(null);
                loadUsers();
            } else {
                toast.error(res.error || "Failed to remove user access.");
            }
        } catch (e) {
            toast.error("An error occurred while removing access.");
        } finally {
            setRemoving(false);
        }
    }

    async function handleUpdateRole() {
        if (!selectedUser || selectedUser.kind !== "membership" || !editedRole) return;
        setUpdatingRole(true);
        try {
            const res = await updateLEMembershipRole(selectedUser.id, editedRole);
            if (res.success) {
                toast.success("Role updated successfully.");
                setSelectedUser(null);
                setEditedRole(null);
                loadUsers();
            } else {
                toast.error(res.error || "Failed to update role.");
            }
        } catch (e) {
            toast.error("An error occurred while updating role.");
        } finally {
            setUpdatingRole(false);
        }
    }

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault();
        if (!inviteEmail) return;

        setInviting(true);
        try {
            const result = await inviteUserToLE(leId, inviteEmail, inviteRole);
            if (result.success) {
                toast.success(`Invited ${inviteEmail} as ${inviteRole.replace("LE_", "")}`);
                setInviteEmail("");
                setInviteRole("LE_USER");
                loadUsers(); // Refresh list
            } else {
                toast.error(result.error || "Failed to invite user.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setInviting(false);
        }
    }

    return (
        <div className="bg-white rounded-b-xl rounded-tr-xl min-h-[600px] p-8 space-y-8">
            {/* Header / Invite Section */}
            <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Team & Access</h2>
                    <p className="text-slate-500 mt-1">Who is responsible for this Legal Entity and what they can do.</p>
                </div>

                {canManageUsers ? (
                    <Card className="w-full md:w-auto min-w-[400px]">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <UserPlus className="h-4 w-4" />
                                Invite New Member
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleInvite} className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="colleague@example.com"
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                            className="h-9"
                                        />
                                    </div>
                                    <Select value={inviteRole} onValueChange={setInviteRole}>
                                        <SelectTrigger className="w-[110px] h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="LE_USER">LE User</SelectItem>
                                            <SelectItem value="LE_ADMIN">LE Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit" size="sm" disabled={inviting} className="h-9">
                                        {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-500">
                                    LE Admin can manage users and sign off. LE User can edit data and answer questions.
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                        <Shield className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>View only — contact an LE Admin to manage membership.</span>
                    </div>
                )}
            </div>

            {/* Users Table */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">{canManageUsers ? "Actions" : "Joined"}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                    Loading users...
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 && invites.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-slate-500 italic">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {users.map((user: any) => {
                                    const displayName = user.name || user.email.split('@')[0];
                                    const initials = user.name ? user.name.substring(0, 2).toUpperCase() : displayName.substring(0, 1).toUpperCase();
                                    
                                    return (
                                        <TableRow key={user.userId}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-xs">
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-900">{displayName}</div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    user.role === "LE_ADMIN"
                                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                                        : "bg-slate-50 text-slate-700 border-slate-200"
                                                }
                                            >
                                                {user.role === "LE_ADMIN" && <Shield className="h-3 w-3 mr-1" />}
                                                {user.role === "LE_ADMIN" ? "LE Admin" : "LE User"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Active
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-slate-500">
                                            {canManageUsers ? (
                                                <Button variant="outline" size="sm" onClick={() => setSelectedUser({
                                                    kind: "membership",
                                                    id: user.membershipId,
                                                    email: user.email,
                                                    displayName,
                                                    role: user.role,
                                                    status: "ACTIVE",
                                                    scopeType: "LE",
                                                    scopeId: leId
                                                })}>
                                                    Manage
                                                </Button>
                                            ) : "-"}
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                                {invites.map((inv: any) => (
                                    <TableRow key={inv.id} className="bg-slate-50/40">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-medium text-xs">
                                                    <Mail className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-700 italic">Pending Invite</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                                        {inv.sentToEmail}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    inv.role === "LE_ADMIN"
                                                        ? "bg-purple-50 text-purple-700 border-purple-200 opacity-70"
                                                        : "bg-slate-50 text-slate-700 border-slate-200 opacity-70"
                                                }
                                            >
                                                {inv.role === "LE_ADMIN" && <Shield className="h-3 w-3 mr-1" />}
                                                {inv.role === "LE_ADMIN" ? "LE Admin" : "LE User"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full w-fit">
                                                <Clock className="h-3 w-3" />
                                                Pending
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-slate-500">
                                            {canManageUsers ? (
                                                <Button variant="outline" size="sm" onClick={() => setSelectedUser({
                                                    kind: "invitation",
                                                    id: inv.id,
                                                    email: inv.sentToEmail,
                                                    displayName: undefined,
                                                    role: inv.role,
                                                    status: "PENDING",
                                                    scopeType: "LE",
                                                    scopeId: leId
                                                })}>
                                                    Manage
                                                </Button>
                                            ) : "-"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* User Access Modal Shell */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => {
                if (!open) {
                    setConfirmRemove(false);
                    setEditedRole(null);
                }
                setSelectedUser(open ? selectedUser : null);
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedUser?.kind === "invitation" ? "Manage invitation" : "Manage access"}
                        </DialogTitle>
                        <DialogDescription>
                            Update roles, manage communication, or remove access.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="py-4 space-y-6">
                            <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="mt-0.5">
                                    <Mail className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900">
                                        {selectedUser.displayName ? `${selectedUser.displayName} (${selectedUser.email})` : selectedUser.email}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1 flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">Status:</span>
                                            <Badge variant="outline" className={selectedUser.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                                                {selectedUser.status === "ACTIVE" ? "Active" : "Pending"}
                                            </Badge>
                                        </div>
                                        {selectedUser.kind === "membership" && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">Scope:</span>
                                                <span>Legal Entity</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-900">Access</h4>
                                <div className="flex items-center gap-3">
                                    <Select 
                                        value={editedRole || selectedUser.role} 
                                        onValueChange={setEditedRole}
                                        disabled={selectedUser.kind === "invitation" || updatingRole}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LE_USER">LE User</SelectItem>
                                            <SelectItem value="LE_ADMIN">LE Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {selectedUser.kind === "membership" && editedRole && editedRole !== selectedUser.role && (
                                        <Button 
                                            size="sm" 
                                            onClick={handleUpdateRole} 
                                            disabled={updatingRole}
                                            className="shrink-0"
                                        >
                                            {updatingRole ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                            Update
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-900">Communication</h4>
                                {selectedUser.kind === "invitation" ? (
                                    <Button variant="outline" className="w-full justify-start" disabled>
                                        <Mail className="w-4 h-4 mr-2" />
                                        Resend invite
                                    </Button>
                                ) : (
                                    <Button variant="outline" className="w-full justify-start" disabled>
                                        <Mail className="w-4 h-4 mr-2" />
                                        Send welcome email
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-3 pt-2 border-t border-red-100">
                                <h4 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" /> Danger Zone
                                </h4>
                                
                                {selectedUser.kind === "invitation" ? (
                                    <Button 
                                        variant="outline" 
                                        className="w-full justify-start border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" 
                                        onClick={handleRevoke}
                                        disabled={revoking}
                                    >
                                        {revoking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                                        Revoke invite
                                    </Button>
                                ) : (
                                    !confirmRemove ? (
                                        <Button 
                                            variant="outline" 
                                            className="w-full justify-start border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={() => setConfirmRemove(true)}
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Remove access
                                        </Button>
                                    ) : (
                                        <div className="bg-red-50 p-3 rounded-md border border-red-100 space-y-3">
                                            <p className="text-sm text-red-800 font-medium flex items-start gap-2">
                                                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                                                Are you sure you want to remove this user's access?
                                            </p>
                                            <div className="flex gap-2">
                                                <Button variant="destructive" size="sm" className="w-full" onClick={handleRemoveAccess} disabled={removing}>
                                                    {removing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Yes, confirm"}
                                                </Button>
                                                <Button variant="outline" size="sm" className="w-full" onClick={() => setConfirmRemove(false)} disabled={removing}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
