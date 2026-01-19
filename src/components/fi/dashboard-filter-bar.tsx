"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface DashboardFilterBarProps {
    availableQuestionnaires?: string[];
    availableClients?: string[];
}

export function DashboardFilterBar({ availableQuestionnaires = [], availableClients = [] }: DashboardFilterBarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const questionnaire = searchParams.get("questionnaire") || "all";
    const client = searchParams.get("client") || "all";

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.push(`?${params.toString()}`);
    };

    const clearFilters = () => {
        router.push("?");
    };

    return (
        <div className="flex items-center gap-4 py-2">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Filters:</span>
            </div>

            {/* Client Filter */}
            <Select
                value={client}
                onValueChange={(val) => updateFilter("client", val)}
            >
                <SelectTrigger className="w-[200px] h-9 text-xs bg-white">
                    <SelectValue placeholder="Filter by Client" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {availableClients.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
            </Select>



            {/* Questionnaire Filter */}
            <Select
                value={questionnaire}
                onValueChange={(val) => updateFilter("questionnaire", val)}
            >
                <SelectTrigger className="w-[240px] h-9 text-xs bg-white">
                    <SelectValue placeholder="Filter by Questionnaire" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Questionnaires</SelectItem>
                    {availableQuestionnaires.map((q) => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Clear Filters (if active) */}
            {(questionnaire !== "all" || client !== "all") && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-slate-400 hover:text-slate-600 h-9"
                >
                    Clear
                </Button>
            )}
        </div>
    );
}
