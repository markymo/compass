"use client";

import { useState, useEffect } from "react";
import { getAllUsers } from "@/actions/admin";
import { getFIs } from "@/actions/fi"; // Reuse to get list of potential orgs if needed, or just specific logic
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Building, Settings } from "lucide-react";
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
                                    <TableHead>Organizations / Roles</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map(u => {
                                    const isSystemAdmin = u.memberships.some((m: any) => m.orgType === "SYSTEM");
                                    return (
                                        <TableRow key={u.userId}>
                                            <TableCell className="font-medium align-top py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-slate-400" />
                                                        {u.email}
                                                    </div>
                                                    {isSystemAdmin && (
                                                        <Badge className="w-fit text-[10px] h-5 px-1.5 bg-amber-500 hover:bg-amber-600 text-white border-none">
                                                            Platform Admin
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                <div className="space-y-2">
                                                    {u.memberships.map((m: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                                            <Badge
                                                                variant={m.orgType === "SYSTEM" ? "default" : "outline"}
                                                                className={`w-20 justify-center shrink-0 text-[10px] ${m.orgType === "SYSTEM" ? "bg-amber-500 hover:bg-amber-600 text-white border-none" : ""}`}
                                                            >
                                                                {m.orgType}
                                                            </Badge>
                                                            <span className="font-medium text-slate-700">{m.orgName}</span>
                                                            <span className="text-slate-400 text-xs">({m.role})</span>
                                                        </div>
                                                    ))}
                                                    {u.memberships.length === 0 && <span className="text-slate-400 italic">No memberships</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-top py-4">
                                                <Button size="sm" variant="secondary" asChild>
                                                    <Link href={`/app/admin/users/${u.userId}`}>
                                                        <Settings className="w-4 h-4 mr-2" />
                                                        Manage
                                                    </Link>
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
        </div>
    );
}
