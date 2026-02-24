"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteQuestionnaire, archiveQuestionnaire } from "@/actions/questionnaire";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface QuestionnaireRowActionsProps {
    questionnaireId: string;
    questionnaireName: string;
    status: string;
}

export function QuestionnaireRowActions({ questionnaireId, questionnaireName, status }: QuestionnaireRowActionsProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${questionnaireName}"? This action cannot be undone.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const res = await deleteQuestionnaire(questionnaireId);
            if (res.success) {
                toast.success("Questionnaire deleted");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to delete");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleArchive = async () => {
        setIsArchiving(true);
        try {
            const res = await archiveQuestionnaire(questionnaireId);
            if (res.success) {
                toast.success("Questionnaire archived");
                router.refresh();
            } else {
                toast.error(res.error || "Failed to archive");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsArchiving(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 ml-2">
                    <span className="sr-only">Open menu</span>
                    {isDeleting || isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
                {status !== "ARCHIVED" && (
                    <DropdownMenuItem onClick={handleArchive}>
                        <Archive className="mr-2 h-4 w-4" />
                        <span>Archive</span>
                    </DropdownMenuItem>
                )}

                {status !== "ARCHIVED" && <DropdownMenuSeparator />}

                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
