"use client";

import { useEffect, useState, useMemo } from "react";
import { getWorkbenchFields, WorkbenchField } from "@/actions/kyc-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Link as LinkIcon, Edit2, CheckCircle2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Pattern3Props {
    leId: string;
}

export function Pattern3MappingMatrix({ leId }: Pattern3Props) {
    const [fields, setFields] = useState<WorkbenchField[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getWorkbenchFields(leId);
            setFields(data);
        } catch (error) {
            console.error("Failed to load workbench fields", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [leId]);

    const mappedFields = fields.filter(f => f.key !== 'UNMAPPED' && f.linkedQuestions.length > 0);

    const formatValue = (val: any) => {
        if (!val) return null;
        if (typeof val === 'object') return Object.values(val).filter(Boolean).join(' ') || null;
        return String(val);
    };

    // Extract unique banks dynamically from linked questions
    const uniqueBanks = useMemo(() => {
        const banks = new Set<string>();
        mappedFields.forEach(field => {
            field.linkedQuestions.forEach(q => {
                if (q.engagementOrgName) banks.add(q.engagementOrgName);
                else banks.add(q.questionnaireName); // Fallback
            });
        });
        return Array.from(banks).sort();
    }, [mappedFields]);

    if (isLoading) {
        return (
            <div className="p-8 space-y-4 h-[calc(100vh-140px)]">
                <Skeleton className="h-10 w-64 mb-6" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white overflow-hidden">
            <div className="p-6 border-b bg-slate-50/50 shrink-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Database className="h-6 w-6 text-indigo-500" />
                    Global Mapping Matrix
                </h1>
                <p className="text-slate-500 mt-1 max-w-2xl text-sm">
                    A dense, grid-based view allowing you to see exactly how your Master Data cascades across all active bank requests. Click any cell to break the link and set a manual override.
                </p>
            </div>

            <ScrollArea className="flex-1 w-full border-b overflow-auto">
                <Table className="min-w-[1200px]">
                    <TableHeader className="bg-slate-100/80 sticky top-0 z-10 shadow-sm border-b">
                        <TableRow>
                            <TableHead className="w-[300px] font-semibold text-slate-900 border-r bg-slate-100/90 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0]">
                                Master Data Field
                            </TableHead>
                            <TableHead className="w-[250px] font-semibold text-indigo-900 bg-indigo-50/50 border-r">
                                <span className="flex items-center gap-1.5">
                                    <Database className="h-4 w-4 text-indigo-500" />
                                    Golden Record
                                </span>
                            </TableHead>
                            {uniqueBanks.map(bank => (
                                <TableHead key={bank} className="font-semibold text-slate-700 w-[200px]">
                                    <span className="flex items-center gap-1.5 w-full">
                                        <Building2 className="h-4 w-4 text-slate-400" />
                                        <span className="truncate" title={bank}>{bank}</span>
                                    </span>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mappedFields.map((field) => (
                            <TableRow key={field.key} className="hover:bg-slate-50/50 transition-colors group">
                                {/* Field Label (Sticky Left) */}
                                <TableCell className="font-medium text-slate-900 border-r bg-white group-hover:bg-slate-50/50 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                                    {field.label}
                                </TableCell>

                                {/* Master Value */}
                                <TableCell className="border-r bg-indigo-50/10 font-medium">
                                    <div className="flex items-center gap-2 text-slate-900">
                                        {formatValue(field.currentValue) || <span className="text-slate-400 font-normal italic">None</span>}
                                    </div>
                                </TableCell>

                                {/* Per-Bank Columns */}
                                {uniqueBanks.map(bank => {
                                    // See if this field maps to a question for this bank
                                    const linkedQs = field.linkedQuestions.filter(q => (q.engagementOrgName || q.questionnaireName) === bank);

                                    if (linkedQs.length === 0) {
                                        return (
                                            <TableCell key={bank} className="bg-slate-50/30">
                                                <span className="text-slate-300 text-xs italic">N/A</span>
                                            </TableCell>
                                        );
                                    }

                                    // Mocking state: let's assume it maps. If we had actual overrides logic, we'd check `q.answer`.
                                    // For visual mockup, we'll assume it's syncing with Master Data unless it has its own answer.
                                    const formattedMasterValue = formatValue(field.currentValue);
                                    const hasOverride = linkedQs.some(q => q.answer && q.answer !== formattedMasterValue);
                                    const displayValue = hasOverride ? linkedQs.find(q => q.answer)?.answer : formattedMasterValue;

                                    return (
                                        <TableCell
                                            key={bank}
                                            className={cn(
                                                "cursor-pointer transition-colors relative",
                                                hasOverride ? "bg-amber-50/50 hover:bg-amber-100/50" : "hover:bg-slate-100"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2 group/cell">
                                                <div className="truncate text-sm" title={displayValue || undefined}>
                                                    {displayValue || <span className="text-slate-400 italic">None</span>}
                                                </div>
                                                <div className="shrink-0 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                                    {hasOverride ? (
                                                        <span title="Local Override">
                                                            <Edit2 className="h-3.5 w-3.5 text-amber-500" />
                                                        </span>
                                                    ) : (
                                                        <span title="Inheriting master data">
                                                            <LinkIcon className="h-3.5 w-3.5 text-slate-400 hover:text-indigo-500" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}

                        {mappedFields.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={uniqueBanks.length + 2} className="h-32 text-center text-slate-500">
                                    No data available.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
}
