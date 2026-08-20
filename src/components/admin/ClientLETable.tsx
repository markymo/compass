"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, Building2, ExternalLink, RotateCcw, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { restoreClientLEFromAdmin } from "@/actions/admin";
import { AdminClientLEItem, getDisplayStatus } from "@/types/admin-client-le";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface ClientLETableProps {
    les: AdminClientLEItem[];
    loading?: boolean;
    emptyMessage?: string;
    onRestoreSuccess?: () => void;
}

export function ClientLETable({
    les,
    loading = false,
    emptyMessage = "No Client Legal Entities found.",
    onRestoreSuccess,
}: ClientLETableProps) {
    const [restoreTarget, setRestoreTarget] = useState<AdminClientLEItem | null>(null);
    const [restoring, setRestoring] = useState(false);

    const handleRestoreConfirm = async () => {
        if (!restoreTarget) return;
        setRestoring(true);
        try {
            const res = await restoreClientLEFromAdmin(restoreTarget.id);
            if (res.success) {
                toast.success(`Restored ${restoreTarget.name}`);
                setRestoreTarget(null);
                if (onRestoreSuccess) {
                    onRestoreSuccess();
                }
            } else {
                toast.error(res.error || "Failed to restore legal entity");
            }
        } catch (e) {
            toast.error("Failed to restore legal entity");
        } finally {
            setRestoring(false);
        }
    };

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Client LE Name</TableHead>
                        <TableHead>Parent Client Organization</TableHead>
                        <TableHead className="w-[110px]">Jurisdiction</TableHead>
                        <TableHead className="w-[180px]">LEI</TableHead>
                        <TableHead className="w-[130px]">Date Created</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[120px]">Engagements</TableHead>
                        <TableHead className="w-[110px]">Members</TableHead>
                        <TableHead className="text-right w-[110px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">
                                <Loader2 className="h-6 w-6 animate-spin inline-block text-amber-600" />
                            </TableCell>
                        </TableRow>
                    ) : les.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        les.map((le) => {
                            const displayStatus = getDisplayStatus(le);
                            return (
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
                                        {le.jurisdiction || "-"}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-slate-600">
                                        {le.lei || "-"}
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
                                            {displayStatus}
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
                                                    Manage LE
                                                </Link>
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>

            <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore Legal Entity</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to restore <span className="font-semibold text-slate-900">{restoreTarget?.name}</span>? This will re-enable access for all assigned users and restore active engagements.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
                        <Button
                            onClick={handleRestoreConfirm}
                            disabled={restoring}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {restoring ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Restoring...
                                </>
                            ) : (
                                "Restore Entity"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
