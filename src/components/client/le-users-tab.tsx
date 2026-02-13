"use client";

import { useState, useEffect } from "react";
import { getLEUsers, inviteUserToLE, LEUser } from "@/actions/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Mail, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface LEUsersTabProps {
    leId: string;
}

export function LEUsersTab({ leId }: LEUsersTabProps) {
    const [users, setUsers] = useState<LEUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Invite State
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("LE_USER");
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        loadUsers();
    }, [leId]);

    async function loadUsers() {
        setLoading(true);
        try {
            const data = await getLEUsers(leId);
            setUsers(data);
        } catch (error) {
            console.error("Failed to load users", error);
            toast.error("Failed to load users.");
        } finally {
            setLoading(false);
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
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h2>
                    <p className="text-slate-500 mt-1">Manage access and permissions for this Legal Entity.</p>
                </div>

                <Card className="w-full md:w-auto min-w-[400px]">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Invite New Member
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleInvite} className="flex gap-2">
                            <div className="flex-1 space-y-2">
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
                                <SelectContent>
                                    <SelectItem value="LE_USER">User</SelectItem>
                                    <SelectItem value="LE_ADMIN">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button type="submit" size="sm" disabled={inviting} className="h-9">
                                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Joined</TableHead>
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
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-slate-500 italic">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.userId}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-xs">
                                                {user.name ? user.name.substring(0, 2).toUpperCase() : "??"}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{user.name || "Unknown"}</div>
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
                                            {user.role.replace("LE_", "")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Active
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-slate-500">
                                        Today
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
