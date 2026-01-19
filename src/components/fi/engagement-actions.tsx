"use client";

import { Button } from "@/components/ui/button";
import { Archive, Trash2, MoreVertical, Loader2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveEngagement, deleteEngagement } from "@/actions/fi";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface EngagementActionsProps {
    engagementId: string;
    clientName: string;
}

export function EngagementActions({ engagementId, clientName }: EngagementActionsProps) {
    const router = useRouter(); // For refresh
    const [isLoading, setIsLoading] = useState(false);

    const handleArchive = async () => {
        if (!confirm(`Archive engagement with ${clientName}?`)) return;
        setIsLoading(true);
        const res = await archiveEngagement(engagementId);
        if (res.success) {
            toast.success("Engagement archived");
            router.refresh();
        } else {
            toast.error("Failed to archive");
        }
        setIsLoading(false);
    };

    const handleDelete = async () => {
        if (!confirm(`Delete engagement with ${clientName}? This is permanent.`)) return;
        setIsLoading(true);
        const res = await deleteEngagement(engagementId);
        if (res.success) {
            toast.success("Engagement deleted");
            router.refresh();
        } else {
            toast.error("Failed to delete");
        }
        setIsLoading(false);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isLoading} className="h-6 w-6 p-0 hover:bg-slate-100 text-slate-400">
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MoreVertical className="h-3 w-3" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    <span>Archive</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
