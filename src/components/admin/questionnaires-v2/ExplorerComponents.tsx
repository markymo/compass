"use client";

import { QV2Row } from "@/actions/questionnaires-v2";
import { formatDistanceToNow, format } from "date-fns";
import {
    PenLine, BookMarked, Hash, Globe, Lock, GitBranch,
    ExternalLink, ArrowRight, ChevronRight, X, Share2, AlertTriangle, Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type TabKey = "working-copy" | "reference" | "other";

interface TableProps {
    rows: QV2Row[];
    tab: TabKey;
    selectedId: string | null;
    onSelect: (row: QV2Row) => void;
    onAddToLibrary: (row: QV2Row) => void;
    onCreateWorkingCopy: (row: QV2Row) => void;
    onShare: (row: QV2Row) => void;
}

// ── Table ───────────────────────────────────────────────────────────────────

export function ExplorerTable({ rows, tab, selectedId, onSelect, onAddToLibrary, onCreateWorkingCopy, onShare }: TableProps) {
    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 py-2 w-[40%]">Name</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-2 w-[16%]">{tab === "other" ? "Owner / Context" : "Owner"}</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-2 w-[16%]">Provenance</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-2 w-[13%]">Updated</th>
                    <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 py-2">Actions</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <ExplorerRow key={row.id} row={row} tab={tab} isSelected={row.id === selectedId} isLast={i === rows.length - 1} onSelect={onSelect} onAddToLibrary={onAddToLibrary} onCreateWorkingCopy={onCreateWorkingCopy} onShare={onShare} />
                ))}
            </tbody>
        </table>
    );
}

// ── Row ─────────────────────────────────────────────────────────────────────

function ExplorerRow({ row, tab, isSelected, isLast, onSelect, onAddToLibrary, onCreateWorkingCopy, onShare }: {
    row: QV2Row; tab: TabKey; isSelected: boolean; isLast: boolean;
    onSelect: (r: QV2Row) => void; onAddToLibrary: (r: QV2Row) => void;
    onCreateWorkingCopy: (r: QV2Row) => void; onShare: (r: QV2Row) => void;
}) {
    const owner = row.ownerOrgName ?? row.fiOrgName ?? "—";
    return (
        <tr onClick={() => onSelect(row)} className={cn("group cursor-pointer transition-colors", !isLast && "border-b border-slate-100", isSelected ? "bg-slate-50 border-l-2 border-l-slate-900" : "hover:bg-slate-50/60 border-l-2 border-l-transparent")}>
            <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                    <RowIcon tab={tab} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={cn("font-medium text-sm leading-snug truncate max-w-[200px]", isSelected ? "text-slate-900" : "text-slate-800")}>{row.name}</span>
                            <StatusPill status={row.status} />
                            {row.functionalCode && <span className="text-[9px] font-semibold tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{row.functionalCode}</span>}
                            {tab === "working-copy" && row.isCoparityOwned && !row.functionalCode && <span title="Missing functionalCode"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            {row.referenceCode ? (
                                <span className="font-mono text-[10px] text-slate-400">{row.referenceCode}</span>
                            ) : tab === "reference" && row.isCoparityOwned ? (
                                <span className="flex items-center gap-1 text-[10px] text-amber-500"><AlertTriangle className="w-3 h-3" /> Missing referenceCode</span>
                            ) : null}
                            {tab === "reference" && row.sharingState && <SharingPill state={row.sharingState} />}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-3 py-2.5">
                {tab === "other" ? (
                    <div className="text-xs text-slate-500 space-y-0.5">
                        <div className="truncate max-w-[130px] font-medium text-slate-700">{row.ownerOrgName || "Unknown"}</div>
                        <div className="text-[10px] truncate max-w-[130px]"><span className="text-slate-400">Client:</span> {row.clientLeShortCode || "XXXXX"}</div>
                        <div className="text-[10px] truncate max-w-[130px]"><span className="text-slate-400">Supplier:</span> {row.supplierShortCode || "SSSSS"}</div>
                    </div>
                ) : (
                    <span className="text-xs text-slate-500 font-medium truncate block max-w-[130px]">Coparity</span>
                )}
            </td>
            <td className="px-3 py-2.5">
                {row.basedOn
                    ? <span className="flex items-center gap-1 text-[11px] text-slate-400"><GitBranch className="w-3 h-3 shrink-0 text-slate-300" /><span className="truncate max-w-[100px]">{row.basedOn}</span></span>
                    : <span className="text-[11px] text-slate-300">—</span>}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[11px] text-slate-400">{formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })}</span></td>
            <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {tab === "working-copy"
                        ? <WCActions id={row.id} onAddToLibrary={() => onAddToLibrary(row)} />
                        : tab === "reference"
                            ? <RefActions id={row.id} onCreateWC={() => onCreateWorkingCopy(row)} onShare={() => onShare(row)} />
                            : <OtherActions id={row.id} />}
                </div>
            </td>
        </tr>
    );
}

function RowIcon({ tab }: { tab: TabKey }) {
    if (tab === "reference") return <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-50 border border-amber-100 shrink-0"><BookMarked className="w-3.5 h-3.5 text-amber-600" /></div>;
    if (tab === "working-copy") return <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-50 border border-blue-100 shrink-0"><PenLine className="w-3.5 h-3.5 text-blue-500" /></div>;
    return <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-50 border border-slate-200 shrink-0"><Box className="w-3.5 h-3.5 text-slate-500" /></div>;
}

export function StatusPill({ status }: { status: string }) {
    if (!status || status === "ACTIVE") return null;
    const cls: Record<string, string> = { DRAFT: "bg-slate-100 text-slate-500", DIGITIZING: "bg-blue-50 text-blue-600", ERROR: "bg-red-50 text-red-500", UPLOADED: "bg-slate-100 text-slate-400" };
    return <span className={cn("text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", cls[status] ?? "bg-slate-100 text-slate-400")}>{status.toLowerCase()}</span>;
}

export function SharingPill({ state }: { state: "PRIVATE" | "RESTRICTED" | "GLOBAL" }) {
    if (state === "GLOBAL") return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
            <Globe className="w-2.5 h-2.5" />Global
        </span>
    );
    if (state === "RESTRICTED") return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
            <Share2 className="w-2.5 h-2.5" />Restricted
        </span>
    );
    return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-full">
            <Lock className="w-2.5 h-2.5" />Private
        </span>
    );
}

function WCActions({ id, onAddToLibrary }: { id: string; onAddToLibrary: () => void }) {
    return (<>
        <Link href={`/app/admin/questionnaires/${id}`} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors">Open</Link>
        <button onClick={onAddToLibrary} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors whitespace-nowrap">Add to Library</button>
    </>);
}

function RefActions({ id, onCreateWC, onShare }: { id: string; onCreateWC: () => void; onShare: () => void }) {
    return (<>
        <Link href={`/app/admin/questionnaires/${id}`} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors">View</Link>
        <button onClick={onCreateWC} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors whitespace-nowrap">Working Copy</button>
        <button onClick={onShare} className="text-[11px] text-slate-600 hover:text-slate-900 p-1 rounded border border-slate-200 hover:border-slate-300 transition-colors"><Share2 className="w-3 h-3" /></button>
    </>);
}

function OtherActions({ id }: { id: string }) {
    return (
        <Link href={`/app/admin/questionnaires/${id}`} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors">View</Link>
    );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ tab }: { tab: TabKey }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                {tab === "reference" ? <BookMarked className="w-4 h-4 text-slate-300" /> : tab === "working-copy" ? <PenLine className="w-4 h-4 text-slate-300" /> : <Box className="w-4 h-4 text-slate-300" />}
            </div>
            <p className="text-sm font-medium text-slate-500">{tab === "working-copy" ? "No working copies" : tab === "reference" ? "No reference library items" : "No other questionnaires"}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {tab === "working-copy" ? "Working copies appear here when questionnaires are in development." : tab === "reference" ? "Add a working copy to the library to create your first stable reference." : "Other questionnaires will appear here."}
            </p>
        </div>
    );
}

// ── Detail Drawer ────────────────────────────────────────────────────────────

export function DetailDrawer({ row, onClose, onAddToLibrary, onCreateWorkingCopy, onShare }: {
    row: QV2Row; onClose: () => void;
    onAddToLibrary: (r: QV2Row) => void;
    onCreateWorkingCopy: (r: QV2Row) => void;
    onShare: (r: QV2Row) => void;
}) {
    const isRef = row.kind === "REFERENCE_SNAPSHOT";
    return (
        <div className="w-72 shrink-0 ml-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {isRef ? <BookMarked className="w-4 h-4 text-amber-600" /> : row.kind === "WORKING_COPY" ? <PenLine className="w-4 h-4 text-blue-500" /> : <Box className="w-4 h-4 text-slate-500" />}
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{isRef ? "Reference Item" : row.kind === "WORKING_COPY" ? "Working Copy" : "Questionnaire"}</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className={cn("px-4 py-4 border-b border-slate-100", isRef ? "bg-amber-50/40" : row.kind === "WORKING_COPY" ? "bg-blue-50/30" : "bg-slate-50/40")}>
                    <p className="font-semibold text-slate-900 text-sm leading-snug">{row.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <StatusPill status={row.status} />
                        {isRef && row.sharingState && <SharingPill state={row.sharingState} />}
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    <DrawerRow label="Func Code" value={row.functionalCode ? <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">{row.functionalCode}</span> : <span className="text-amber-500 flex items-center gap-1 justify-end"><AlertTriangle className="w-3 h-3" /> Missing</span>} />
                    <DrawerRow label="Ref Code" value={row.referenceCode ? <span className="font-mono text-[10px] text-slate-500">{row.referenceCode}</span> : isRef ? <span className="text-amber-500 flex items-center gap-1 justify-end"><AlertTriangle className="w-3 h-3" /> Missing</span> : <span className="text-slate-300 italic text-[11px]">N/A</span>} />
                    <DrawerRow label="Questions" value={row.questionCount > 0 ? <span className="flex items-center gap-1 justify-end"><Hash className="w-3 h-3 text-slate-300" />{row.questionCount}</span> : "—"} />
                    <DrawerRow label="Owner" value={row.isCoparityOwned ? "Coparity" : (row.ownerOrgName || "Unknown")} />
                    {!row.isCoparityOwned && row.kind === "ENGAGEMENT_QUESTIONNAIRE" && (
                        <>
                            <DrawerRow label="Client LE" value={row.clientLeShortCode || "XXXXX"} />
                            <DrawerRow label="Supplier" value={row.supplierShortCode || "SSSSS"} />
                        </>
                    )}
                    <DrawerRow label="Based on" value={row.basedOn
                        ? <span className="flex items-center gap-1 text-right"><GitBranch className="w-3 h-3 text-slate-300 shrink-0" />{row.basedOn}</span>
                        : <span className="text-slate-300 italic text-[11px]">No lineage recorded</span>} />
                    <DrawerRow label="Last updated" value={formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })} />
                    <DrawerRow label="Created" value={format(new Date(row.createdAt), "d MMM yyyy")} />
                    {row.hasFile && <DrawerRow label="File" value={<span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">attached</span>} />}
                </div>

                {isRef && (
                    <div className="px-4 py-3 bg-amber-50/50 border-t border-amber-100">
                        <p className="text-[10px] text-amber-700 leading-relaxed">Read-only. To make changes, create a working copy and add a revised version.</p>
                    </div>
                )}

                <div className="px-4 py-3 border-t border-slate-100 space-y-1.5">
                    {isRef && row.isCoparityOwned ? (
                        <>
                            <Link href={`/app/admin/questionnaires/${row.id}`} className="flex items-center justify-between w-full text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                                View questionnaire <ExternalLink className="w-3 h-3" />
                            </Link>
                            <button onClick={() => onCreateWorkingCopy(row)} className="flex items-center justify-between w-full text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded border border-blue-200 hover:border-blue-300 transition-colors">
                                Working Copy <ArrowRight className="w-3 h-3" />
                            </button>
                            <button onClick={() => onShare(row)} className="flex items-center justify-between w-full text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                                Share… <Share2 className="w-3 h-3" />
                            </button>
                        </>
                    ) : row.kind === "WORKING_COPY" && row.isCoparityOwned ? (
                        <>
                            <Link href={`/app/admin/questionnaires/${row.id}`} className="flex items-center justify-between w-full text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                                Open editor <ChevronRight className="w-3 h-3" />
                            </Link>
                            <button onClick={() => onAddToLibrary(row)} className="flex items-center justify-between w-full text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded border border-amber-200 hover:border-amber-300 transition-colors">
                                Add to Reference Library <BookMarked className="w-3 h-3" />
                            </button>
                            <button disabled className="w-full text-left text-xs text-slate-300 px-3 py-2 cursor-not-allowed">Archive…</button>
                        </>
                    ) : (
                        <Link href={`/app/admin/questionnaires/${row.id}`} className="flex items-center justify-between w-full text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                            View <ExternalLink className="w-3 h-3" />
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

function DrawerRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-2 px-4 py-2.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 pt-0.5">{label}</span>
            <span className="text-xs text-slate-700 text-right">{value}</span>
        </div>
    );
}
