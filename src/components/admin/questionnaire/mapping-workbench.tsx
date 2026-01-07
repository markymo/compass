"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HelpCircle, LayoutTemplate, Plus } from "lucide-react";
import { ExtractedItem } from "@/actions/ai-mapper";
import { STANDARD_CATEGORIES } from "@/lib/constants";

interface MappingWorkbenchProps {
    items: ExtractedItem[];
    masterFields: any[];
    onUpdateItem: (index: number, field: keyof ExtractedItem, value: any) => void;
    onAddItem: () => void;
}

export function MappingWorkbench({ items, masterFields, onUpdateItem, onAddItem }: MappingWorkbenchProps) {

    // --- Grouping Logic ---
    const sections = useMemo(() => {
        if (!items || items.length === 0) return [];

        const groups: { title: string, startIndex: number, items: { item: ExtractedItem, originalIndex: number }[] }[] = [];
        let currentGroup = { title: "General", startIndex: 0, items: [] as { item: ExtractedItem, originalIndex: number }[] };

        items.forEach((item, idx) => {
            if (item.type === "SECTION") {
                if (currentGroup.items.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = { title: item.originalText, startIndex: idx, items: [] };
            } else {
                currentGroup.items.push({ item, originalIndex: idx });
            }
        });
        if (currentGroup.items.length > 0) groups.push(currentGroup);

        return groups;
    }, [items]);

    return (
        <div className="w-full bg-slate-50 flex flex-col overflow-hidden shadow-xl z-20 h-full border-l">
            {/* Workbench Header */}
            <div className="p-4 border-b bg-white flex justify-between items-center flex-none">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-indigo-500" />
                    Extraction Grid
                </h2>
                <div className="text-xs text-slate-500">
                    Review and map identified questions
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth">
                {items.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <p>No items extracted yet.</p>
                    </div>
                )}

                {sections.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider sticky top-0 bg-slate-50/95 py-2 backdrop-blur-sm z-10 border-b border-transparent">
                            <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                            {section.title}
                            <span className="text-xs font-normal text-slate-400 ml-2">({section.items.length} Elements)</span>
                        </div>

                        <div className="space-y-3 pl-2">
                            {section.items.map(({ item, originalIndex }) => {
                                const isQuestion = item.type === "QUESTION";
                                // const isMapped = !!item.masterKey && item.masterKey !== "IGNORE";
                                const isMapped = !!item.masterKey && item.masterKey !== "IGNORE";
                                const isCategorized = !!item.category && item.category !== "IGNORE";

                                // Status Color Logic
                                let statusColor = "border-slate-200"; // Default
                                if (isQuestion) {
                                    if (isMapped) statusColor = "border-emerald-200 bg-emerald-50/30";
                                    else if (isCategorized) statusColor = "border-amber-200 bg-amber-50/30";
                                    else statusColor = "border-red-200 bg-red-50/10";
                                } else {
                                    statusColor = "border-slate-100 bg-slate-50 opacity-80";
                                }

                                // Remove the filter (User Req: Show All Elements)
                                // if (!isQuestion) return null; 

                                return (
                                    <Card key={originalIndex} className={`p-4 transition-all duration-200 ${statusColor} shadow-sm hover:shadow-md group`}>

                                        {/* Top Row: Original Text & Type Selector */}
                                        <div className="mb-3">
                                            <div className="text-xs font-medium text-slate-500 mb-1 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    {/* Type Selector */}
                                                    <Select
                                                        value={item.type}
                                                        onValueChange={(val) => onUpdateItem(originalIndex, "type", val)}
                                                    >
                                                        <SelectTrigger className="h-6 text-[10px] w-auto border-none shadow-none bg-transparent p-0 hover:bg-slate-100 px-1 rounded text-slate-500 font-bold uppercase tracking-wider">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="QUESTION">Question</SelectItem>
                                                            <SelectItem value="SECTION">Section</SelectItem>
                                                            <SelectItem value="INSTRUCTION">Instruction</SelectItem>
                                                            <SelectItem value="NOTE">Note</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <span className={`text-[10px] uppercase font-bold tracking-wider ${!isQuestion ? "text-slate-400" :
                                                    isMapped ? "text-emerald-600" : isCategorized ? "text-amber-600" : "text-red-400"
                                                    }`}>
                                                    {!isQuestion ? item.type : (isMapped ? "Mapped" : isCategorized ? "Categorized" : "Unmapped")}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-700 leading-relaxed font-serif italic border-l-2 border-slate-200 pl-3 py-1">
                                                "{item.originalText}"
                                            </div>
                                        </div>

                                        {/* Bottom Row: Inputs (Only for Questions) */}
                                        {isQuestion && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-1">

                                                {/* 1. Neutral Text */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-slate-400 uppercase">Neutral Question</label>
                                                    <Input
                                                        value={item.neutralText || ""}
                                                        onChange={(e) => onUpdateItem(originalIndex, "neutralText", e.target.value)}
                                                        className="h-8 text-sm bg-white"
                                                        placeholder="Standardized question text..."
                                                    />
                                                </div>

                                                {/* 2. Mapping or Category */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-slate-400 uppercase flex justify-between">
                                                        <span>Map to Master Schema</span>
                                                        {item.confidence > 0 && <span className="text-slate-300">{(item.confidence * 100).toFixed(0)}% Match</span>}
                                                    </label>

                                                    {/* Master Key Select */}
                                                    <Select
                                                        value={item.masterKey || "IGNORE"}
                                                        onValueChange={(val) => {
                                                            const newVal = val === "IGNORE" ? undefined : val;
                                                            onUpdateItem(originalIndex, "masterKey", newVal);
                                                        }}
                                                    >
                                                        <SelectTrigger className={`h-8 text-sm bg-white ${isMapped ? "border-emerald-500 text-emerald-700 font-medium" : ""}`}>
                                                            <SelectValue placeholder="Select Field..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="IGNORE" className="text-slate-400 font-mono">-- No Direct Match --</SelectItem>
                                                            {masterFields.map(f => (
                                                                <SelectItem key={f.key} value={f.key}>
                                                                    {f.label} <span className="text-xs text-slate-400 font-mono ml-2">[{f.key}]</span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    {/* Category Select (Always visible) */}
                                                    <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                                        <label className="text-[10px] font-semibold text-amber-500 uppercase flex items-center gap-1 mb-1">
                                                            <HelpCircle className="w-3 h-3" />
                                                            Category
                                                        </label>
                                                        <Select
                                                            value={item.category || "IGNORE"}
                                                            onValueChange={(val) => {
                                                                const newVal = val === "IGNORE" ? undefined : val;
                                                                onUpdateItem(originalIndex, "category", newVal);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-sm bg-amber-50/50 border-amber-200">
                                                                <SelectValue placeholder="Select Category..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="IGNORE">-- Uncategorized --</SelectItem>
                                                                {STANDARD_CATEGORIES.map(c => (
                                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ))}



                <div className="pt-4 pb-12">
                    <Button onClick={onAddItem} variant="outline" className="w-full border-dashed text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200">
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Element
                    </Button>
                </div>

                <div className="h-20" /> {/* Spacer */}
            </div>
        </div>
    );
}
