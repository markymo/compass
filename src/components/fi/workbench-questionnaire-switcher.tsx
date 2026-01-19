"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface WorkbenchQuestionnaireSwitcherProps {
    engagementId: string;
    currentQuestionnaireId: string;
    questionnaires: {
        id: string;
        name: string;
        status?: string;
    }[];
}

export function WorkbenchQuestionnaireSwitcher({
    engagementId,
    currentQuestionnaireId,
    questionnaires
}: WorkbenchQuestionnaireSwitcherProps) {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    const selectedQuestionnaire = questionnaires.find(q => q.id === currentQuestionnaireId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[280px] justify-between text-slate-700 bg-white border-slate-300 shadow-sm"
                >
                    <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 shrink-0 text-indigo-500" />
                        <span className="truncate font-medium">{selectedQuestionnaire?.name || "Select Questionnaire..."}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0">
                <Command>
                    <CommandInput placeholder="Search questionnaires..." />
                    <CommandList>
                        <CommandEmpty>No questionnaire found.</CommandEmpty>
                        <CommandGroup heading="Available Questionnaires">
                            {questionnaires.map((q) => (
                                <CommandItem
                                    key={q.id}
                                    value={q.name}
                                    onSelect={() => {
                                        setOpen(false);
                                        router.push(`/app/fi/engagements/${engagementId}/workbench/${q.id}`);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentQuestionnaireId === q.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="truncate">{q.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
