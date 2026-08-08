"use client";

import { Button } from "@/components/ui/button";
import { Archive, Trash2, MoreVertical, AlertCircle } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveClientLE, deleteClientLE, forceDeleteClientLE } from "@/actions/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmArchiveDialog, ConfirmDeleteDialog, ConfirmHardDeleteDialog } from "@/components/shared/confirm-dialogs";

interface ClientLEActionsProps {
    leId: string;
    leName: string;
    isSystemAdmin?: boolean;
}

export function ClientLEActions({ leId, leName, isSystemAdmin }: ClientLEActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showArchive, setShowArchive] = useState(false);
    const [showSoftDelete, setShowSoftDelete] = useState(false);
    const [showForceDelete, setShowForceDelete] = useState(false);

    const handleArchiveConfirm = async () => {
        setIsLoading(true);
        const res = await archiveClientLE(leId);
        if (res.success) {
            toast.success("Entity archived");
            router.push("/app");
        } else {
            toast.error("Failed to archive");
        }
        setIsLoading(false);
    };

    const handleSoftDeleteConfirm = async () => {
        setIsLoading(true);
        const res = await deleteClientLE(leId);
        if (res.success) {
            toast.success("Entity soft deleted");
            router.push("/app");
        } else {
            toast.error(res.error || "Failed to delete");
        }
        setIsLoading(false);
    };

    const handleForceDeleteConfirm = async () => {
        setIsLoading(true);
        const res = await forceDeleteClientLE(leId);
        if (res.success) {
            toast.success("Entity PERMANENTLY deleted");
            router.push("/app");
        } else {
            toast.error(res.error || "Failed to force delete");
        }
        setIsLoading(false);
    };

    return (
        <>
            <ConfirmArchiveDialog
                open={showArchive}
                onOpenChange={setShowArchive}
                itemName={leName}
                onConfirm={handleArchiveConfirm}
                isLoading={isLoading}
            />
            <ConfirmDeleteDialog
                open={showSoftDelete}
                onOpenChange={setShowSoftDelete}
                itemName={leName}
                title="Soft delete Legal Entity?"
                description={`This will soft delete "${leName}". The entity and its data can be restored later by an admin.`}
                confirmLabel="Soft Delete"
                onConfirm={handleSoftDeleteConfirm}
                isLoading={isLoading}
            />
            <ConfirmHardDeleteDialog
                open={showForceDelete}
                onOpenChange={setShowForceDelete}
                itemName={leName}
                confirmationString={leName}
                title="Permanently delete Legal Entity?"
                description={`CRITICAL WARNING: This will permanently destroy "${leName}", all associated engagements, documents, questionnaires, and history. There is NO UNDO.`}
                onConfirm={handleForceDeleteConfirm}
                isLoading={isLoading}
            />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isLoading} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowArchive(true); }}>
                        <Archive className="mr-2 h-4 w-4" />
                        <span>Archive Entity</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowSoftDelete(true); }} className="text-red-600 focus:text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Soft Delete</span>
                    </DropdownMenuItem>

                    {isSystemAdmin && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-red-800 font-bold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Admin Zone
                            </DropdownMenuLabel>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowForceDelete(true); }} className="text-red-700 font-bold focus:text-red-800 focus:bg-red-50">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>FORCE DELETE (Perma)</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
