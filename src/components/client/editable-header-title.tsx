"use client";

import { useState, useRef, useEffect } from "react";
import { updateClientLE } from "@/actions/client";
import { Pencil, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface EditableHeaderTitleProps {
    leId: string;
    initialValue: string;
    isSystemAdmin?: boolean;
    isVerified?: boolean;
}

export function EditableHeaderTitle({ leId, initialValue, isSystemAdmin, isVerified }: EditableHeaderTitleProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (!value.trim() || value === initialValue) {
            setValue(initialValue);
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setSaveStatus("idle");

        try {
            const result = await updateClientLE(leId, { name: value.trim() });
            if (result.success) {
                setSaveStatus("success");
                setIsEditing(false);
                router.refresh();
            } else {
                setSaveStatus("error");
                setValue(initialValue);
            }
        } catch (error) {
            setSaveStatus("error");
            setValue(initialValue);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus("idle"), 3000);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            setValue(initialValue);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 group min-w-0">
                <input
                    ref={inputRef}
                    type="text"
                    className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-zinc-900 border-none focus:ring-2 focus:ring-indigo-500 rounded px-1 -ml-1 w-full outline-none"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                />
                {isSaving && <Loader2 className="h-5 w-5 animate-spin text-slate-400 shrink-0" />}
            </div>
        );
    }

    return (
        <div 
            className="group relative flex items-center gap-2 cursor-pointer min-w-0"
            onClick={() => setIsEditing(true)}
        >
            <h1 className={cn(
                "text-2xl md:text-3xl font-bold tracking-tight truncate",
                isVerified ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
            )}>
                {value}
            </h1>
            
            <div className="flex items-center gap-1.5 shrink-0">
                {saveStatus === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {saveStatus === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                
                <Pencil className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
    );
}
