"use client";

import { useState, useEffect } from "react";
import { getAllUsers, updateUserOrg, bootstrapSystemOrg } from "@/actions/admin";
import { getFIs } from "@/actions/fi"; // Reuse to get list of potential orgs if needed, or just specific logic
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, User, Building, Settings } from "lucide-react";
import Link from "next/link";

export default function UserAdminPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const data = await getAllUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handlePromote(userId: string) {
        if (!confirm("Grant SYSTEM ADMIN access to this user?")) return;

        // Ensure System Org Exists
        const sysOrg = await bootstrapSystemOrg();

        const res = await updateUserOrg(userId, sysOrg.id);
        if (res.success) loadData();
        else alert("Failed: " + res.error);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">System Administrator User Management</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Platform Users</CardTitle>
                    <CardDescription>Manage user access and organization assignment.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Email</TableHead>
                                    <TableHead>Organization</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(u => (
                                    <TableRow key={`${u.userId}-${u.orgId}`}>
                                        <TableCell className="font-medium">{u.email}</TableCell>
                                        <TableCell>{u.orgName}</TableCell>
                                        <TableCell>
                                            <Badge variant={u.orgType === "SYSTEM" ? "destructive" : "secondary"}>
                                                {u.orgType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right flex items-center justify-end gap-2">
                                            <Button size="sm" variant="secondary" asChild>
                                                <Link href={`/app/admin/users/${u.userId}`}>
                                                    <Settings className="w-4 h-4 mr-2" />
                                                    Manage
                                                </Link>
                                            </Button>

                                            {u.orgType !== "SYSTEM" && (
                                                <Button size="sm" variant="outline" onClick={() => handlePromote(u.userId)}>
                                                    <ShieldAlert className="w-4 h-4 mr-2" />
                                                    Make Admin
                                                </Button>
                                            )}
                                            {u.orgType === "SYSTEM" && (
                                                <span className="text-muted-foreground text-sm italic">
                                                    (Super Admin)
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
