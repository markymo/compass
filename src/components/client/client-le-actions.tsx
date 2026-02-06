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
import { archiveClientLE, deleteClientLE, forceDeleteClientLE } from "@/actions/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface ClientLEActionsProps {
    leId: string;
    leName: string;
    isSystemAdmin?: boolean;
}

export function ClientLEActions({ leId, leName, isSystemAdmin }: ClientLEActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleArchive = async () => {
        if (!confirm(`Are you sure you want to archive ${leName}? It will be hidden from the dashboard.`)) return;

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

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to SOFT DELETE ${leName}? This action can be undone by an admin.`)) return;

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

    const handleForceDelete = async () => {
        if (!confirm(`CRITICAL WARNING: You are a System Admin about to FORCE DELETE ${leName}.\n\nThis will PERMANENTLY remove:\n- The Legal Entity Record\n- All Engagements\n- All Documents\n- All Questionnaires\n- All History\n\nThere is NO UNDO. Are you absolutely sure?`)) return;

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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isLoading} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    <span>Archive Entity</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Soft Delete</span>
                </DropdownMenuItem>

                {isSystemAdmin && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-red-800 font-bold flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Admin Zone
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={handleForceDelete} className="text-red-700 font-bold focus:text-red-800 focus:bg-red-50">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>FORCE DELETE (Perma)</span>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
