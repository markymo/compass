"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrainCircuit, Sparkles, FileText, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LearnedItem {
    id: string;
    fact: string;
    source: string;
    timestamp: Date;
}

export function RecentlyLearned({ items = [] }: { items?: LearnedItem[] }) {
    return (
        <Card className="border-indigo-100 bg-indigo-50/30 shadow-none">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-900">
                    <BrainCircuit className="h-4 w-4 text-indigo-600" />
                    Recently Learned
                </CardTitle>
                <CardDescription className="text-xs text-indigo-600/80">
                    New facts extracted from your documents
                </CardDescription>
            </CardHeader>
            <CardContent>
                {items.length > 0 ? (
                    <ScrollArea className="h-[200px] pr-3">
                        <div className="space-y-3">
                            {items.map((item) => (
                                <div key={item.id} className="flex gap-3 items-start p-2 rounded-lg bg-white border border-indigo-100 shadow-sm">
                                    <div className="mt-0.5 p-1 bg-indigo-50 rounded text-indigo-600">
                                        <Sparkles className="h-3 w-3" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-xs font-medium text-slate-900 leading-tight">
                                            Learned <span className="text-indigo-700">{item.fact}</span>
                                        </p>
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                            <FileText className="h-3 w-3" />
                                            <span className="truncate max-w-[120px]">{item.source}</span>
                                            <span>•</span>
                                            <span className="whitespace-nowrap">
                                                {item.timestamp.toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                        <div className="h-10 w-10 rounded-full bg-white border border-dashed border-indigo-200 flex items-center justify-center">
                            <BrainCircuit className="h-5 w-5 text-indigo-300" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-indigo-900">Waiting to learn...</p>
                            <p className="text-[10px] text-indigo-600/70 leading-relaxed px-4">
                                Answer questionnaires or upload documents. Compass will auto-detect and save verification facts here.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
