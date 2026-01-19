"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

// Mock interface for now, matching closely to what getFIEngagements returns
interface Engagement {
    id: string;
    status: string;
    clientLE: {
        name: string;
    };
    questionnaires: {
        name: string;
        id: string;
    }[];
    updatedAt?: Date | string; // Optional if not always present in join
}

interface EngagementListProps {
    engagements: Engagement[];
}

export function EngagementList({ engagements }: EngagementListProps) {
    if (engagements.length === 0) {
        return null;
    }

    return (
        <div className="rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-sm text-slate-700">Recent Engagements</h3>
                <span className="text-xs text-slate-500">{engagements.length} active</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
                <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow className="hover:bg-slate-50">
                            <TableHead className="w-[200px] text-xs h-9">Client Enitity</TableHead>
                            <TableHead className="text-xs h-9">Status</TableHead>
                            <TableHead className="text-xs h-9">Questionnaires</TableHead>
                            <TableHead className="text-xs h-9 text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {engagements.map((eng) => (
                            <TableRow key={eng.id} className="group">
                                <TableCell className="font-medium text-xs py-2">
                                    {eng.clientLE.name}
                                </TableCell>
                                <TableCell className="py-2">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                                        {eng.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-2">
                                    <div className="flex flex-wrap gap-1">
                                        {eng.questionnaires.slice(0, 2).map((q) => (
                                            <span
                                                key={q.id}
                                                className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] px-1.5 rounded-sm"
                                            >
                                                <FileText className="w-3 h-3 text-slate-400" />
                                                {q.name}
                                            </span>
                                        ))}
                                        {eng.questionnaires.length > 2 && (
                                            <span className="text-[10px] text-slate-400 pl-1">
                                                +{eng.questionnaires.length - 2} more
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right py-2">
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-indigo-50 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Link href={`/app/fi/engagements/${eng.id}`}>
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
