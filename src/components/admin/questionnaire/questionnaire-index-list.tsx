"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, FileType2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { QuestionnaireRowActions } from "@/components/admin/questionnaire/questionnaire-row-actions";

export interface QuestionnaireIndexItem {
    id: string;
    name: string;
    status: string;
    updatedAt: Date;
    createdAt: Date;
    mappings: unknown | null;
    fileName: string | null;
    fileUrl: string | null;
    ownerOrgId: string | null;
    fiEngagementId: string | null;
    fiOrg: { name: string } | null;
}

type FilterKey = "all" | "system" | "engagement";

function classify(q: QuestionnaireIndexItem): "system" | "engagement" {
    return q.fiEngagementId !== null ? "engagement" : "system";
}

const FILTER_LABELS: Record<FilterKey, string> = {
    all: "All",
    system: "System / Admin",
    engagement: "Engagement / Relationship",
};

interface TypeBadgeProps { type: "system" | "engagement" }
function TypeBadge({ type }: TypeBadgeProps) {
    if (type === "engagement") {
        return (
            <Badge variant="outline" className="rounded-md font-medium bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
                Engagement / Relationship
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="rounded-md font-medium bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]">
            System / Admin
        </Badge>
    );
}

export function QuestionnaireIndexList({ items }: { items: QuestionnaireIndexItem[] }) {
    const [filter, setFilter] = useState<FilterKey>("all");

    const counts = useMemo(() => ({
        all: items.length,
        system: items.filter(q => classify(q) === "system").length,
        engagement: items.filter(q => classify(q) === "engagement").length,
    }), [items]);

    const filtered = useMemo(() => {
        if (filter === "all") return items;
        return items.filter(q => classify(q) === filter);
    }, [items, filter]);

    return (
        <div className="space-y-4">
            {/* ── Segmented filter ─────────────────────────────────────────── */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                {(["all", "system", "engagement"] as FilterKey[]).map(key => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            filter === key
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        {FILTER_LABELS[key]}
                        <span className={cn(
                            "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none min-w-[18px]",
                            filter === key ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-500"
                        )}>
                            {counts[key]}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── Table ────────────────────────────────────────────────────── */}
            <Table>
                <TableHeader className="bg-slate-50/80">
                    <TableRow>
                        <TableHead className="w-[45%]">Name / Source</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mapping</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-48 text-slate-500">
                                <div className="flex flex-col items-center justify-center">
                                    <FileText className="h-8 w-8 text-slate-300 mb-2" />
                                    <p className="font-medium text-slate-600">No records match this filter.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        filtered.map((q) => {
                            const isFileBased = !!q.fileUrl;
                            const isSourceDoc = q.status === "UPLOADED";
                            const type = classify(q);

                            return (
                                <TableRow key={q.id} className="hover:bg-slate-50/80 transition-colors">
                                    <TableCell>
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "mt-0.5 p-2 rounded-lg shrink-0",
                                                isFileBased ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                                            )}>
                                                {isFileBased ? <FileType2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-900">
                                                    {isFileBased && q.name === "Untitled Questionnaire" ? q.fileName : q.name}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    {isFileBased
                                                        ? `Source: ${q.fileName} • Uploaded ${formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}`
                                                        : "Manual Entry"}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <TypeBadge type={type} />
                                    </TableCell>

                                    <TableCell>
                                        <Badge
                                            variant={q.status === "ACTIVE" ? "default" : "secondary"}
                                            className={cn(
                                                "rounded-md font-medium",
                                                q.status === "DIGITIZING" && "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
                                                q.status === "UPLOADED" && "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                                            )}
                                        >
                                            {q.status}
                                        </Badge>
                                    </TableCell>

                                    <TableCell>
                                        {isSourceDoc ? (
                                            <span className="text-slate-400 text-sm">—</span>
                                        ) : q.mappings ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">Mapped</Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 capitalize">Pending</Badge>
                                        )}
                                    </TableCell>

                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {isFileBased && q.fileUrl && (
                                                <Button variant="ghost" size="sm" asChild className="hover:bg-blue-50 hover:text-blue-600">
                                                    <a href={q.fileUrl} target="_blank" rel="noopener noreferrer" title="View Source File">
                                                        Source
                                                    </a>
                                                </Button>
                                            )}
                                            <Link href={`/app/admin/questionnaires/${q.id}`}>
                                                <Button size="sm" variant="ghost" className="hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                                    Manage <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </Link>
                                            <QuestionnaireRowActions
                                                questionnaireId={q.id}
                                                questionnaireName={q.fileName || q.name}
                                                status={q.status}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
