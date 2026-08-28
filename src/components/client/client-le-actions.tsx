"use client";

import { Button } from "@/components/ui/button";
import { Trash2, MoreVertical } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteClientLE } from "@/actions/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";

interface ClientLEActionsProps {
    leId: string;
    leName: string;
}

export function ClientLEActions({ leId, leName }: ClientLEActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

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
            <ConfirmDeleteDialog
                open={showDelete}
                onOpenChange={setShowDelete}
                itemName={leName}
                title="Delete Legal Entity?"
                description="This will remove the legal entity from your workspace, including its relationships and questionnaires. It can be restored for up to 30 days if you change your mind. After that, recovery may no longer be possible."
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
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowDelete(true); }} className="text-red-600 focus:text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
