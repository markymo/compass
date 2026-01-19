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

interface ClientLEActionsProps {
    leId: string;
    leName: string;
}

export function ClientLEActions({ leId, leName }: ClientLEActionsProps) {
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
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${leName}? This action cannot be undone.`)) return;

        setIsLoading(true);
        const res = await deleteClientLE(leId);
        if (res.success) {
            toast.success("Entity deleted");
            router.push("/app");
        } else {
            toast.error("Failed to delete");
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
                    <span>Delete Entity</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
