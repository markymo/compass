"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Clock, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FIKanbanCardProps {
    engagement: {
        id: string;
        clientName: string;
        fundName?: string;
        status: string;
        slaStatus?: 'ok' | 'warning' | 'breached';
        slaText?: string;
        lastActivity?: string;
        progress?: number;
    };
}

export function FIKanbanCard({ engagement }: FIKanbanCardProps) {
    const isSlaWarning = engagement.slaStatus === 'warning';
    const isSlaBreached = engagement.slaStatus === 'breached';

    return (
        <Card className={cn(
            "border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer group",
            isSlaBreached ? "border-l-red-500" :
                isSlaWarning ? "border-l-amber-500" :
                    "border-l-indigo-500"
        )}>
            <CardContent className="p-4 space-y-3">
                {/* Header: Client & Fund */}
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-semibold text-slate-900 line-clamp-1">{engagement.clientName}</h4>
                        {engagement.fundName && (
                            <p className="text-xs text-slate-500 line-clamp-1">{engagement.fundName}</p>
                        )}
                    </div>
                </div>

                {/* Progress Bar (Mini) */}
                {engagement.progress !== undefined && (
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full rounded-full"
                            style={{ width: `${engagement.progress}%` }}
                        />
                    </div>
                )}

                {/* Metadata Row */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5" title="Last Activity">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{engagement.lastActivity || 'Recently'}</span>
                    </div>

                    {engagement.slaText && (
                        <div className={cn(
                            "flex items-center gap-1 font-medium",
                            isSlaBreached ? "text-red-600" :
                                isSlaWarning ? "text-amber-600" :
                                    "text-emerald-600"
                        )}>
                            {isSlaBreached ? <AlertCircle className="w-3.5 h-3.5" /> : null}
                            {engagement.slaText}
                        </div>
                    )}
                </div>

                {/* Action Footer */}
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center opacity-75 group-hover:opacity-100 transition-opacity">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-slate-50">
                        {engagement.status}
                    </Badge>
                    <Link href={`/app/fi/engagements/${engagement.id}`}>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 pr-1 pl-2 hover:bg-indigo-50 hover:text-indigo-600">
                            Review <ArrowRight className="w-3 h-3" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
