"use client";

import { useState, useEffect } from "react";
import { getAllClientLEsForAdmin, restoreClientLEFromAdmin } from "@/actions/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, Building, Building2, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface ParentOrg {
    id: string;
    name: string;
    shortCode: string | null;
}

interface ClientLEItem {
    id: string;
    name: string;
    shortCode: string | null;
    status: string;
    isDeleted: boolean;
    createdAt: string;
    parentOrgs: ParentOrg[];
    engagementCount: number;
    memberCount: number;
}

export default function ClientLEsAdminPage() {
    const [clientLEs, setClientLEs] = useState<ClientLEItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [restoreTarget, setRestoreTarget] = useState<ClientLEItem | null>(null);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const data = await getAllClientLEsForAdmin();
            setClientLEs(data);
        } catch (e) {
            console.error("Failed to load Client Legal Entities:", e);
        } finally {
            setLoading(false);
        }
    }

    const handleRestoreConfirm = async () => {
        if (!restoreTarget) return;
        setRestoring(true);
        try {
            const res = await restoreClientLEFromAdmin(restoreTarget.id);
            if (res.success) {
                toast.success(`Restored ${restoreTarget.name}`);
                setRestoreTarget(null);
                await loadData();
            } else {
                toast.error(res.error || "Failed to restore legal entity");
            }
        } catch (e) {
            toast.error("Failed to restore legal entity");
        } finally {
            setRestoring(false);
        }
    };

    const filteredLEs = clientLEs.filter((le) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesName = le.name.toLowerCase().includes(q);
        const matchesShortCode = le.shortCode?.toLowerCase().includes(q) ?? false;
        const matchesParent = le.parentOrgs.some((p) =>
            p.name.toLowerCase().includes(q) || (p.shortCode?.toLowerCase().includes(q) ?? false)
        );
        return matchesName || matchesShortCode || matchesParent;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Client Legal Entities</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Administrative directory of all Client Legal Entities ($A \to Z$).
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search legal entities or parent organizations..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client LE Name</TableHead>
                                <TableHead>Parent Client Organization</TableHead>
                                <TableHead className="w-[140px]">Date Created</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead className="w-[130px]">Engagements</TableHead>
                                <TableHead className="w-[110px]">Members</TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin inline-block text-amber-600" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredLEs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        {searchQuery ? "No legal entities matching search." : "No Client Legal Entities found."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLEs.map((le) => (
                                    <TableRow key={le.id} className={le.isDeleted ? "bg-slate-50/50" : undefined}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Building className={`w-4 h-4 shrink-0 ${le.isDeleted ? "text-slate-300" : "text-slate-400"}`} />
                                                <Link
                                                    href={`/app/le/${le.id}`}
                                                    className={`font-semibold transition-colors ${
                                                        le.isDeleted 
                                                            ? "text-slate-500 hover:text-amber-600 hover:underline"
                                                            : "text-slate-900 hover:text-amber-600 hover:underline"
                                                    }`}
                                                >
                                                    {le.name}
                                                </Link>
                                                {le.shortCode && (
                                                    <Badge
                                                        variant="outline"
                                                        className="font-mono text-[10px] uppercase px-1.5 py-0.2 bg-slate-50 border-slate-200 text-slate-600"
                                                    >
                                                        {le.shortCode}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {le.parentOrgs.length > 0 ? (
                                                <div className="space-y-1">
                                                    {le.parentOrgs.map((org) => (
                                                        <div key={org.id} className="flex items-center gap-1.5 text-sm">
                                                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <Link
                                                                href={`/app/admin/organizations/${org.id}`}
                                                                className="font-medium text-slate-700 hover:text-amber-600 hover:underline transition-colors"
                                                            >
                                                                {org.name}
                                                            </Link>
                                                            {org.shortCode && (
                                                                <span className="text-xs font-mono text-slate-400">
                                                                    ({org.shortCode})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            {new Date(le.createdAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-semibold uppercase px-2 py-0.5 ${
                                                    le.isDeleted
                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                        : le.status === "ACTIVE"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                                }`}
                                            >
                                                {le.isDeleted ? "DELETED" : le.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="secondary"
                                                className="font-normal text-xs bg-slate-100 text-slate-700"
                                            >
                                                {le.engagementCount} active
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="secondary"
                                                className="font-normal text-xs bg-slate-100 text-slate-700"
                                            >
                                                {le.memberCount} members
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {le.isDeleted ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-2 text-slate-700 hover:text-amber-700 hover:bg-amber-50 border-slate-200"
                                                    onClick={() => setRestoreTarget(le)}
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                                    Restore
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-2 text-slate-600 hover:text-amber-600"
                                                    asChild
                                                >
                                                    <Link href={`/app/le/${le.id}`}>
                                                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                                        View
                                                    </Link>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore {restoreTarget?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will restore the legal entity, its engagements, and questionnaires to active status.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
                        <Button
                            disabled={restoring}
                            onClick={handleRestoreConfirm}
                        >
                            {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Restore
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
