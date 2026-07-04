"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { removeRequirement } from "@/actions/requirements";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-dialogs";

export function RemoveRequirementButton({ engagementId, questionnaireId }: { engagementId: string, questionnaireId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [showConfirm, setShowConfirm] = useState(false);

    const handleRemoveConfirm = () => {
        startTransition(async () => {
            await removeRequirement(engagementId, questionnaireId);
            setShowConfirm(false);
            router.refresh();
        });
    };

    return (
        <>
            <ConfirmDeleteDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                title="Remove Questionnaire?"
                description="Are you sure you want to remove this questionnaire? Answers already provided will remain in your Master Record."
                onConfirm={async () => handleRemoveConfirm()}
                isLoading={isPending}
                confirmLabel="Remove"
            />
            <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowConfirm(true)}
                disabled={isPending}
                title="Remove from requirements"
            >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
        </>
    );
}
