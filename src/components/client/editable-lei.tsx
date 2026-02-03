"use client";

import { useState } from "react";
import { updateClientLE } from "@/actions/client";
import { Loader2, Fingerprint, Pencil, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEILookup } from "./lei-lookup";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface EditableLEIProps {
    leId: string;
    initialLei?: string | null;
    initialFetchedAt?: Date | null;
}

export function EditableLEI({ leId, initialLei, initialFetchedAt }: EditableLEIProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    // Normal state for formatted display
    const [lei, setLei] = useState(initialLei || "");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: any, summary: any) => {
        setIsSaving(true);
        try {
            const res = await updateClientLE(leId, {
                lei: data.id,
                gleifData: data
            });

            if (res.success) {
                toast.success("LEI updated and validated with GLEIF");
                setLei(data.id);
                setIsEditing(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to update LEI");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div className="bg-slate-50 border rounded-lg p-4 animate-in fade-in zoom-in-95 data-[state=open]:animate-out data-[state=closed]:fade-out-0">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <Fingerprint className="h-4 w-4" />
                        Update Legal Entity Identifier
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
                <LEILookup
                    initialLei={lei}
                    onDataFetched={handleSave}
                />
                {isSaving && (
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving record...
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="group flex items-center gap-3 py-1">
            <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-mono transition-colors",
                lei
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900"
                    : "bg-slate-50 border-dashed border-slate-200 text-slate-400"
            )}>
                <Fingerprint className="h-3.5 w-3.5 opacity-70" />

                {lei ? (
                    <span>{lei}</span>
                ) : (
                    <span className="italic">No LEI assigned</span>
                )}

                {lei && <CheckCircle className="h-3.5 w-3.5 text-green-600 ml-1" />}
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-300 opacity-0 group-hover:opacity-100 transition-all hover:text-slate-600"
                onClick={() => setIsEditing(true)}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>

            {lei && initialFetchedAt && (
                <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Verified {new Date(initialFetchedAt).toLocaleDateString()}
                </span>
            )}
        </div>
    );
}
