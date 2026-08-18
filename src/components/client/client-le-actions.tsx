"use client";

import { Button } from "@/components/ui/button";
import { Archive, Trash2, MoreVertical } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveClientLE, deleteClientLE } from "@/actions/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmArchiveDialog, ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";

interface ClientLEActionsProps {
    leId: string;
    leName: string;
}

export function ClientLEActions({ leId, leName }: ClientLEActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showArchive, setShowArchive] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

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

    const handleDeleteConfirm = async () => {
        setIsLoading(true);
        const res = await deleteClientLE(leId);
        if (res.success) {
            toast.success("Entity deleted");
            router.push("/app");
        } else {
            toast.error(res.error || "Failed to delete");
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
                open={showDelete}
                onOpenChange={setShowDelete}
                itemName={leName}
                title="Delete Legal Entity?"
                description={`This will delete "${leName}". The entity and its data can be restored later if needed.`}
                confirmLabel="Delete"
                onConfirm={handleDeleteConfirm}
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
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowDelete(true); }} className="text-red-600 focus:text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
