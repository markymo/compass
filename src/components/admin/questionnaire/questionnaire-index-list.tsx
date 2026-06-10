"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    FileText, ArrowRight, FileType2,
    // Kind icons
    PencilLine, BookMarked, Link2,
    // Visibility icons
    Lock, Globe, ShieldAlert,
} from "lucide-react";
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
    kind: string | null;
    visibility: string | null;
    fiOrg: { name: string } | null;
    fiEngagement: {
        org: { name: string; shortCode: string | null };
        clientLE: { id: string; name: string };
    } | null;
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

// ── Kind icon ────────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    WORKING_COPY: {
        icon: PencilLine,
        label: "Working Copy",
        className: "text-slate-500",
    },
    REFERENCE_SNAPSHOT: {
        icon: BookMarked,
        label: "Reference Snapshot",
        className: "text-indigo-500",
    },
    ENGAGEMENT_QUESTIONNAIRE: {
        icon: Link2,
        label: "Engagement Questionnaire",
        className: "text-amber-500",
    },
};

function KindIcon({ kind }: { kind: string | null }) {
    if (!kind) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-slate-300 text-xs">—</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">No kind set (legacy)</TooltipContent>
            </Tooltip>
        );
    }
    const cfg = KIND_CONFIG[kind];
    if (!cfg) return <span className="text-slate-300 text-xs">—</span>;
    const Icon = cfg.icon;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-slate-100 transition-colors cursor-default">
                    <Icon className={cn("h-4 w-4", cfg.className)} />
                </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{cfg.label}</TooltipContent>
        </Tooltip>
    );
}

// ── Visibility icon ───────────────────────────────────────────────────────────

const VISIBILITY_CONFIG: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    PRIVATE: {
        icon: Lock,
        label: "Private",
        className: "text-slate-400",
    },
    RESTRICTED: {
        icon: ShieldAlert,
        label: "Restricted (org-gated)",
        className: "text-amber-500",
    },
    GLOBAL: {
        icon: Globe,
        label: "Global (publicly discoverable)",
        className: "text-emerald-500",
    },
};

function VisibilityIcon({ visibility, kind }: { visibility: string | null; kind: string | null }) {
    // Visibility is only meaningful for REFERENCE_SNAPSHOT; show dash otherwise
    const showDash = !visibility || kind !== "REFERENCE_SNAPSHOT";
    if (showDash) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-slate-200 text-xs">—</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    Visibility only applies to Reference Snapshots
                </TooltipContent>
            </Tooltip>
        );
    }
    const cfg = VISIBILITY_CONFIG[visibility!];
    if (!cfg) return <span className="text-slate-300 text-xs">—</span>;
    const Icon = cfg.icon;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-slate-100 transition-colors cursor-default">
                    <Icon className={cn("h-4 w-4", cfg.className)} />
                </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{cfg.label}</TooltipContent>
        </Tooltip>
    );
}

// ── Name / Source cell with overflow tooltip ──────────────────────────────────

function NameCell({ q }: { q: QuestionnaireIndexItem }) {
    const isFileBased = !!q.fileUrl;
    const displayName = isFileBased && q.name === "Untitled Questionnaire" ? q.fileName : q.name;
    const subText = isFileBased
        ? `Source: ${q.fileName} • Uploaded ${formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}`
        : "Manual Entry";

    // Full detail shown in tooltip when truncated
    const fullDetail = [
        `Name: ${displayName}`,
        isFileBased ? `File: ${q.fileName}` : null,
        `Created: ${formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}`,
        `Updated: ${formatDistanceToNow(new Date(q.updatedAt), { addSuffix: true })}`,
        q.fiOrg ? `Owner org: ${q.fiOrg.name}` : null,
    ].filter(Boolean).join("\n");

    return (
        <div className="flex items-start gap-2.5 min-w-0">
            <div className={cn(
                "mt-0.5 p-1.5 rounded-lg shrink-0",
                isFileBased ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
            )}>
                {isFileBased ? <FileType2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="font-semibold text-slate-900 truncate max-w-[220px] cursor-default" title={displayName ?? ""}>
                            {displayName}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent
                        side="bottom"
                        align="start"
                        className="text-xs max-w-[320px] whitespace-pre-line leading-relaxed"
                    >
                        {fullDetail}
                    </TooltipContent>
                </Tooltip>
                <div className="text-[11px] text-slate-400 truncate max-w-[220px] mt-0.5">
                    {subText}
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

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
        <TooltipProvider delayDuration={300}>
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
                            {/* Narrowed from 35% — gives back space to the two icon columns */}
                            <TableHead className="w-[28%]">Name / Source</TableHead>
                            <TableHead className="w-[80px] text-center">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="cursor-default">Kind</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                                        <p className="font-semibold mb-1">Lifecycle kind</p>
                                        <p>✏️ Working Copy — editable draft</p>
                                        <p>📚 Reference Snapshot — published library item</p>
                                        <p>🔗 Engagement — scoped to a client relationship</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TableHead>
                            <TableHead className="w-[80px] text-center">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="cursor-default">Vis.</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                                        <p className="font-semibold mb-1">Visibility (Reference Snapshots only)</p>
                                        <p>🔒 Private — owner org only</p>
                                        <p>🛡 Restricted — org-gated via grants</p>
                                        <p>🌐 Global — all orgs can discover</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TableHead>
                            <TableHead>Engagement</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Mapping</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-48 text-slate-500">
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

                                        {/* Name / Source — truncated, tooltip on hover */}
                                        <TableCell>
                                            <NameCell q={q} />
                                        </TableCell>

                                        {/* Kind icon */}
                                        <TableCell className="text-center">
                                            <KindIcon kind={q.kind} />
                                        </TableCell>

                                        {/* Visibility icon */}
                                        <TableCell className="text-center">
                                            <VisibilityIcon visibility={q.visibility} kind={q.kind} />
                                        </TableCell>

                                        {/* Engagement context */}
                                        <TableCell>
                                            {type === "engagement" && q.fiEngagement ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wide"
                                                        title={q.fiEngagement.org.name}
                                                    >
                                                        {q.fiEngagement.org.shortCode ?? q.fiEngagement.org.name.slice(0, 6).toUpperCase()}
                                                    </span>
                                                    <span className="text-slate-300 text-xs">→</span>
                                                    <span
                                                        className="text-xs text-slate-600 truncate max-w-[130px]"
                                                        title={q.fiEngagement.clientLE.name}
                                                    >
                                                        {q.fiEngagement.clientLE.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-sm">—</span>
                                            )}
                                        </TableCell>

                                        {/* Status */}
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

                                        {/* Mapping */}
                                        <TableCell>
                                            {isSourceDoc ? (
                                                <span className="text-slate-400 text-sm">—</span>
                                            ) : q.mappings ? (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">Mapped</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 capitalize">Pending</Badge>
                                            )}
                                        </TableCell>

                                        {/* Actions */}
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
        </TooltipProvider>
    );
}
