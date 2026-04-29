"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, ShieldAlert, Landmark, ExternalLink } from "lucide-react";
import { purgeClientLE } from "@/actions/super-admin";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";

interface EntityManagementTableProps {
    clientName: string;
    clientLEs: any[];
    onUpdate: () => void;
}

export function EntityManagementTable({ clientName, clientLEs, onUpdate }: EntityManagementTableProps) {
    const [purgingId, setPurgingId] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    async function handlePurge() {
        if (!purgingId) return;
        setIsPurging(true);
        try {
            const res = await purgeClientLE(purgingId);
            if (res.success) {
                toast.success("Entity and all data purged successfully");
                onUpdate();
            } else {
                toast.error(res.error || "Failed to purge");
            }
        } catch (e) {
            toast.error("An error occurred during purge");
        } finally {
            setIsPurging(false);
            setConfirmOpen(false);
            setPurgingId(null);
        }
    }

    return (
        <Card className="border-red-100 bg-red-50/10">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-slate-500" />
                        Legal Entity Workspaces: {clientName}
                    </CardTitle>
                    <CardDescription>
                        Manage and purge Legal Entity environments for this client.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Entity Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Jurisdiction</TableHead>
                            <TableHead className="text-right">God Mode Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clientLEs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                    No Legal Entities found for this client.
                                </TableCell>
                            </TableRow>
                        ) : (
                            clientLEs.map((le: any) => (
                                <TableRow key={le.id}>
                                    <TableCell>
                                        <div className="font-medium flex items-center gap-2">
                                            {le.name}
                                            <Link href={`/app/le/${le.id}`} target="_blank">
                                                <ExternalLink className="h-3 w-3 text-slate-400 hover:text-slate-600 transition-colors" />
                                            </Link>
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-400">{le.id}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={le.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                            {le.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {le.jurisdiction || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => {
                                                setPurgingId(le.id);
                                                setConfirmOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Purge
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="border-red-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <ShieldAlert className="h-5 w-5" />
                            Purge Legal Entity Environment?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <p className="font-bold text-slate-900">
                                This is a permanent, destructive action.
                            </p>
                            <p>
                                Purging this Legal Entity will delete:
                            </p>
                            <ul className="list-disc list-inside text-xs space-y-1 bg-slate-50 p-2 rounded">
                                <li>All Engagement records and Questionnaires</li>
                                <li>All Questions and Answers</li>
                                <li>All uploaded Documents and Evidence</li>
                                <li>All Master Data field claims asserted by this client</li>
                                <li>All Knowledge Graph nodes and edges specific to this client</li>
                                <li>All User Memberships specifically for this LE</li>
                            </ul>
                            <p className="text-xs italic text-red-500">
                                Global data (like the Legal Entity reference itself or global registry nodes) will be preserved, but all client-specific overrides and work will be lost forever.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPurging}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handlePurge}
                            disabled={isPurging}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isPurging ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Yes, Purge Everything
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
