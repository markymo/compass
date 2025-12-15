"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { removeRequirement } from "@/actions/requirements";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RemoveRequirementButton({ engagementId, questionnaireId }: { engagementId: string, questionnaireId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleRemove = () => {
        if (!confirm("Are you sure you want to remove this questionnaire? Answers already provided will remain in your Master Record.")) return;

        startTransition(async () => {
            await removeRequirement(engagementId, questionnaireId);
            router.refresh();
        });
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={handleRemove}
            disabled={isPending}
            title="Remove from requirements"
        >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
    );
}
