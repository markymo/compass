"use client";

import { useState, useEffect } from "react";
import { ClientSelector } from "./ClientSelector";
import { getClientUsers, getClientContext } from "@/actions/super-admin-users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, ShieldAlert, UserCog } from "lucide-react";
import { UserPermissionsSheet } from "./UserPermissionsSheet";
import { AddUserDialog } from "./AddUserDialog";
import { Loader2 } from "lucide-react";

export function UserManagementWizard() {
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [clientContext, setClientContext] = useState<any>(null); // { id, name, clientLEs }
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Editing State
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    useEffect(() => {
        if (selectedClientId) {
            loadData(selectedClientId);
        } else {
            setUsers([]);
            setClientContext(null);
        }
    }, [selectedClientId]);

    async function loadData(id: string) {
        setLoading(true);
        // Parallel fetch
        const [userData, contextData] = await Promise.all([
            getClientUsers(id),
            getClientContext(id)
        ]);

        setUsers(userData);
        setClientContext(contextData);
        setLoading(false);
    }

    function handleEdit(user: any) {
        setEditingUser(user);
        setIsSheetOpen(true);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight">User Permissions Manager</h2>
                    <p className="text-sm text-slate-500">Select a client to manage their users and access levels.</p>
                </div>
                <ClientSelector
                    value={selectedClientId || undefined}
                    onChange={setSelectedClientId}
                />
            </div>

            {selectedClientId && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Users Matrix: {clientContext?.name}</CardTitle>
                            <CardDescription>
                                {users.length} users associated with this client.
                            </CardDescription>
                        </div>
                        <AddUserDialog
                            clientId={selectedClientId}
                            onSuccess={() => loadData(selectedClientId)}
                        />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                No users found. Add one to get started.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Client Role (Building)</TableHead>
                                        <TableHead>LE Access (Rooms)</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u) => {
                                        const leCount = Object.keys(u.leRoles).length;
                                        return (
                                            <TableRow key={u.user.id}>
                                                <TableCell>
                                                    <div className="font-medium">{u.user.email}</div>
                                                    {u.user.name && <div className="text-xs text-muted-foreground">{u.user.name}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    {u.clientRole ? (
                                                        <Badge variant={u.clientRole === 'ADMIN' ? 'default' : 'secondary'}>
                                                            {u.clientRole}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs italic">No Role</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline">{leCount} Entities</Badge>
                                                        {leCount > 0 && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {Object.values(u.leRoles).includes("EDITOR") || Object.values(u.leRoles).includes("ADMIN") ? "Has Edit Rights" : "View Only"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(u)}>
                                                        <UserCog className="h-4 w-4 text-slate-500" />
                                                        <span className="sr-only">Edit</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Edit Sheet */}
            {clientContext && (
                <UserPermissionsSheet
                    isOpen={isSheetOpen}
                    onClose={() => { setIsSheetOpen(false); setEditingUser(null); }}
                    user={editingUser}
                    clientId={selectedClientId!}
                    clientName={clientContext.name}
                    les={clientContext.clientLEs || []}
                    onUpdate={() => loadData(selectedClientId!)}
                />
            )}
        </div>
    );
}
