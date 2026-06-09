"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Settings, PowerOff } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { GroupEditDialog } from "./group-edit-dialog";
import { toggleGroupActive } from "@/actions/master-data-governance";

interface GroupActionsProps {
    group: any;
}

export function GroupActions({ group }: GroupActionsProps) {
    const router = useRouter();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);

    const handleDeactivate = async () => {
        setIsDeactivating(true);
        try {
            const res = await toggleGroupActive(group.id, false);
            if (res.success) {
                toast.success(`"${group.label}" deactivated. It will no longer appear in the picker or propagation.`);
                router.refresh();
            } else {
                toast.error((res as any).error || "Failed to deactivate group");
            }
        } finally {
            setIsDeactivating(false);
            setIsDeactivateDialogOpen(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel>Group Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Edit Metadata
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/20"
                        onClick={() => setIsDeactivateDialogOpen(true)}
                    >
                        <PowerOff className="mr-2 h-4 w-4" />
                        Deactivate Group
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <GroupEditDialog
                group={group}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
            />

            {/* Deactivate confirmation */}
            <AlertDialog
                open={isDeactivateDialogOpen}
                onOpenChange={setIsDeactivateDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate "{group.label}"?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>
                                    Setting this group to inactive will immediately:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Remove it from the questionnaire field picker</li>
                                    <li>Stop propagation of field changes to group-mapped questions</li>
                                    <li>Hide it from AI questionnaire extraction context</li>
                                </ul>
                                <p className="text-amber-700 dark:text-amber-400 font-medium">
                                    Existing questionnaire mappings ({" "}
                                    <code className="text-xs">masterQuestionGroupId = &quot;{group.key}&quot;</code>
                                    {" "}) are not removed. Re-activate the group to restore functionality.
                                </p>
                                <p>
                                    The group&apos;s field items ({group.items?.length ?? 0} fields) are preserved and can be
                                    managed after reactivation.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeactivate}
                            disabled={isDeactivating}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isDeactivating ? "Deactivating…" : "Deactivate Group"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
