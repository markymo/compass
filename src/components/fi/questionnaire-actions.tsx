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
import { archiveQuestionnaire, deleteQuestionnaire } from "@/actions/questionnaire";
import { useState } from "react";
import { ConfirmArchiveDialog, ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface QuestionnaireActionsProps {
    id: string;
    name: string;
}

export function QuestionnaireActions({ id, name }: QuestionnaireActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showArchive, setShowArchive] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    const handleArchiveConfirm = async () => {
        setIsLoading(true);
        const res = await archiveQuestionnaire(id);
        if (res.success) {
            toast.success("Questionnaire archived");
            router.refresh();
        } else {
            toast.error("Failed to archive");
        }
        setIsLoading(false);
    };

    const handleDeleteConfirm = async () => {
        setIsLoading(true);
        const res = await deleteQuestionnaire(id);
        if (res.success) {
            toast.success("Questionnaire deleted");
            router.refresh();
        } else {
            toast.error("Failed to delete");
        }
        setIsLoading(false);
    };

    return (
        <>
            <ConfirmArchiveDialog
                open={showArchive}
                onOpenChange={setShowArchive}
                itemName={name}
                onConfirm={handleArchiveConfirm}
                isLoading={isLoading}
            />
            <ConfirmDeleteDialog
                open={showDelete}
                onOpenChange={setShowDelete}
                itemName={name}
                title="Delete questionnaire?"
                description={`This will permanently delete questionnaire "${name}". This action cannot be undone.`}
                confirmLabel="Delete Questionnaire"
                onConfirm={handleDeleteConfirm}
                isLoading={isLoading}
            />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isLoading} className="h-8 w-8 p-0 hover:bg-slate-100 text-slate-400">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowArchive(true); }}>
                        <Archive className="mr-2 h-4 w-4" />
                        <span>Archive</span>
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
