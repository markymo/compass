
"use client";

import { useState, useRef, useEffect } from "react";
import { updateClientLE } from "@/actions/client";
import { Pencil, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableDescriptionProps {
    leId: string;
    initialValue: string | null;
}

export function EditableDescription({ leId, initialValue }: EditableDescriptionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue || "");
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
                textareaRef.current.value.length,
                textareaRef.current.value.length
            );
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (value === (initialValue || "")) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setSaveStatus("idle");

        try {
            const result = await updateClientLE(leId, { description: value });
            if (result.success) {
                setSaveStatus("success");
                setIsEditing(false);
            } else {
                setSaveStatus("error");
            }
        } catch (error) {
            setSaveStatus("error");
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus("idle"), 3000);
        }
    };

    if (isEditing) {
        return (
            <div className="relative group w-full">
                <textarea
                    ref={textareaRef}
                    className="w-full min-h-[100px] p-0 text-lg text-slate-600 bg-transparent border-none focus:ring-0 resize-none font-sans leading-relaxed"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleSave}
                    disabled={isSaving}
                    placeholder="Describe this Legal Entity or project..."
                />
                <div className="absolute bottom-0 right-0 flex items-center gap-2 p-2">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded">
                        Saves on click-away
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="group relative cursor-pointer min-h-[60px] flex flex-col justify-center"
            onClick={() => setIsEditing(true)}
        >
            <div className="flex items-start justify-between gap-4">
                <p className={cn(
                    "text-lg leading-relaxed transition-colors",
                    value ? "text-slate-600" : "text-slate-400 italic"
                )}>
                    {value || "Add a description for this Legal Entity..."}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    {saveStatus === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {saveStatus === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                    <Pencil className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>

            {/* Hover bar hint */}
            <div className="absolute -bottom-2 left-0 w-full h-[1px] bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}
