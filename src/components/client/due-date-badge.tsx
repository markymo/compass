"use client";

import { useState, useTransition, useEffect } from "react";
import { format, isPast, isToday, addDays, isBefore } from "date-fns";
import { Calendar as CalendarIcon, Clock, ChevronDown, Info, CornerDownRight, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { updateLEDueDate, updateEngagementDueDate, updateQuestionnaireDueDate } from "@/actions/client-le";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { differenceInDays, startOfDay } from "date-fns";

interface DueDateBadgeProps {
    date: Date | null;
    effectiveDate: Date | null;
    source: 'LE' | 'RELATIONSHIP' | 'QUESTIONNAIRE';
    level: 'LE' | 'RELATIONSHIP' | 'QUESTIONNAIRE';
    id: string; // The ID of the entity at the current level
    label?: string;
}

export function DueDateBadge({ date, effectiveDate, source, level, id, label }: DueDateBadgeProps) {
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
    const { preferences } = usePreferences();
    const [draftDate, setDraftDate] = useState(date ? format(date, "yyyy-MM-dd") : "");

    useEffect(() => {
        if (isOpen) {
            setDraftDate(date ? format(date, "yyyy-MM-dd") : "");
        }
    }, [isOpen, date]);

    const activeDate = effectiveDate || date;
    const isOverridden = date !== null && level !== 'LE';
    const isInherited = level !== 'LE' && !date && effectiveDate;

    const getStatusColor = (d: Date) => {
        if (isPast(d) && !isToday(d)) return "text-red-700 bg-red-50 border-red-200 shadow-sm";
        if (isBefore(d, addDays(new Date(), 7))) return "text-amber-700 bg-amber-50 border-amber-200 shadow-sm";
        return "text-slate-700 bg-white border-slate-200 shadow-sm";
    };

    const getWhimsyLabel = (d: Date) => {
        if (!preferences.whimsyMode) return "";

        const today = startOfDay(new Date());
        const target = startOfDay(d);
        const diff = differenceInDays(target, today);

        if (diff > 0) return ` (${diff} more big sleeps)`;
        if (diff === 0) return " (Tonight's the night!)";
        if (isPast(d)) return " (You're late! No more sleeps!)";
        return "";
    };

    const handleUpdate = async (newDate: string) => {
        const d = newDate ? new Date(newDate) : null;

        startTransition(async () => {
            let res;
            if (level === 'LE') res = await updateLEDueDate(id, d);
            else if (level === 'RELATIONSHIP') res = await updateEngagementDueDate(id, d);
            else res = await updateQuestionnaireDueDate(id, d);

            if (res.success) {
                toast.success("Due date updated");
                setIsOpen(false);
            } else {
                toast.error("Failed to update due date");
            }
        });
    };

    const handleClear = () => handleUpdate("");

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-8 gap-2 px-3 font-normal bg-white hover:bg-slate-50 border shadow-sm",
                        activeDate ? getStatusColor(activeDate) : "text-slate-500 border-dashed"
                    )}
                >
                    {activeDate ? (
                        <>
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">
                                {label ? `${label}: ` : ""}{format(activeDate, "MMM dd, yyyy")}
                                {getWhimsyLabel(activeDate)}
                            </span>
                            {level !== 'LE' && (
                                <span className="flex items-center gap-1 ml-1 px-1 py-0.5 rounded bg-white/50 border border-black/5">
                                    {isOverridden ? (
                                        <User className="h-2.5 w-2.5" />
                                    ) : (
                                        <CornerDownRight className="h-2.5 w-2.5" />
                                    )}
                                </span>
                            )}
                            <ChevronDown className="h-3 w-3 opacity-40 ml-1 shrink-0" />
                        </>
                    ) : (
                        <>
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs">Set Due Date</span>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-4" align="start">
                <div className="space-y-2">
                    <h4 className="font-medium text-sm">
                        {level === 'LE' ? "Entity Due Date" : level === 'RELATIONSHIP' ? "Relationship Deadline" : "Instance Deadline"}
                    </h4>
                    <p className="text-xs text-slate-500">
                        {level === 'LE'
                            ? "Sets the default deadline for all relationships and questionnaires."
                            : "Inherited from parent unless overridden here."
                        }
                    </p>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="flex-1 min-w-0 px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={draftDate}
                            onChange={(e) => setDraftDate(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && draftDate !== (date ? format(date, "yyyy-MM-dd") : "")) {
                                    handleUpdate(draftDate);
                                }
                            }}
                            disabled={isPending}
                        />
                        <Button
                            variant="default"
                            size="sm"
                            className="h-[38px]"
                            onClick={() => handleUpdate(draftDate)}
                            disabled={isPending || draftDate === (date ? format(date, "yyyy-MM-dd") : "")}
                        >
                            Save
                        </Button>
                    </div>

                    {level !== 'LE' && date && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                            onClick={handleClear}
                            disabled={isPending}
                        >
                            <X className="h-3 w-3 mr-2" />
                            Clear Override
                        </Button>
                    )}

                    {isInherited && (
                        <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-100 italic">
                            <Info className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-700">
                                Currently inheriting <strong>{format(activeDate!, "MMM dd")}</strong> from {(source as string) === 'LE' ? 'Legal Entity' : 'Relationship'}.
                            </p>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
