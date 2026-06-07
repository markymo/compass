"use client";

import { QV2Row } from "@/actions/questionnaires-v2";
import { formatDistanceToNow, format } from "date-fns";
import {
    FileEdit, BookMarked, Hash, Globe, Lock, GitBranch,
    ExternalLink, ArrowRight, ChevronRight, Eye, AlertTriangle, Box, Trash2, Archive,
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
    onVisibility: (row: QV2Row) => void;
    onArchiveWC: (row: QV2Row) => void;
    onDeleteWC: (row: QV2Row) => void;
    onArchiveRef: (row: QV2Row) => void;
    onDeleteRef: (row: QV2Row) => void;
}

// ── Table ───────────────────────────────────────────────────────────────────

export function ExplorerTable({ rows, tab, selectedId, onSelect, onAddToLibrary, onCreateWorkingCopy, onVisibility, onArchiveWC, onDeleteWC, onArchiveRef, onDeleteRef }: TableProps) {
    return (
        <table className="w-full text-sm table-fixed">
            <colgroup>
                {/* Name: takes all available space */}
                <col className="w-auto min-w-0" />
                {/* Owner */}
                <col style={{ width: "11rem" }} />
                {/* Provenance */}
                <col style={{ width: "9rem" }} />
                {/* Updated */}
                <col style={{ width: "7rem" }} />
                {/* Actions */}
                <col style={{ width: "13rem" }} />
            </colgroup>
            <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 py-2">Name / Code</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-2">{tab === "other" ? "Owner / Context" : "Owner"}</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-2">Provenance</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-2">Updated</th>
                    <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 py-2">Actions</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <ExplorerRow key={row.id} row={row} tab={tab} isSelected={row.id === selectedId} isLast={i === rows.length - 1}
                        onSelect={onSelect} onAddToLibrary={onAddToLibrary} onCreateWorkingCopy={onCreateWorkingCopy} onVisibility={onVisibility}
                        onArchiveWC={onArchiveWC} onDeleteWC={onDeleteWC} onArchiveRef={onArchiveRef} onDeleteRef={onDeleteRef} />
                ))}
            </tbody>
        </table>
    );
}

// ── Row ─────────────────────────────────────────────────────────────────────

function ExplorerRow({ row, tab, isSelected, isLast, onSelect, onAddToLibrary, onCreateWorkingCopy, onVisibility, onArchiveWC, onDeleteWC, onArchiveRef, onDeleteRef }: {
    row: QV2Row; tab: TabKey; isSelected: boolean; isLast: boolean;
    onSelect: (r: QV2Row) => void; onAddToLibrary: (r: QV2Row) => void;
    onCreateWorkingCopy: (r: QV2Row) => void; onVisibility: (r: QV2Row) => void;
    onArchiveWC: (r: QV2Row) => void; onDeleteWC: (r: QV2Row) => void;
    onArchiveRef: (r: QV2Row) => void; onDeleteRef: (r: QV2Row) => void;
}) {
    return (
        <tr onClick={() => onSelect(row)} className={cn("group cursor-pointer transition-colors", !isLast && "border-b border-slate-100", isSelected ? "bg-slate-50 border-l-2 border-l-slate-900" : "hover:bg-slate-50/60 border-l-2 border-l-transparent")}>
            {/* ── Name / Code ── */}
            <td className="px-4 py-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <RowIcon tab={tab} />
                    <div className="min-w-0 flex-1">
                        {/* Primary name — monospace, wraps */}
                        <div className="flex items-start gap-2 flex-wrap">
                            <span className={cn(
                                "font-mono text-[11px] font-semibold leading-snug break-all",
                                isSelected ? "text-slate-900" : "text-slate-800"
                            )}>
                                {row.name}
                            </span>
                            <StatusPill status={row.status} />
                            {row.functionalCode && (
                                <span className="text-[9px] font-semibold tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                    {row.functionalCode}
                                </span>
                            )}
                            {tab === "working-copy" && row.isCoparityOwned && !row.functionalCode && (
                                <span title="Missing functionalCode"><AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>
                            )}
                        </div>
                        {/* Reference code sub-line */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {row.referenceCode ? (
                                <span className="font-mono text-[10px] text-slate-400 break-all">{row.referenceCode}</span>
                            ) : tab === "reference" && row.isCoparityOwned ? (
                                <span className="flex items-center gap-1 text-[10px] text-amber-500"><AlertTriangle className="w-3 h-3 shrink-0" /> Missing referenceCode</span>
                            ) : null}
                            {tab === "reference" && row.sharingState && <SharingPill state={row.sharingState} />}
                        </div>
                    </div>
                </div>
            </td>
            {/* ── Owner ── */}
            <td className="px-3 py-3">
                {tab === "other" ? (
                    <div className="text-xs text-slate-500 space-y-0.5">
                        <div className="truncate font-medium text-slate-700">{row.ownerOrgName || "Unknown"}</div>
                        <div className="text-[10px] truncate"><span className="text-slate-400">Client:</span> {row.clientLeShortCode || "XXXXX"}</div>
                        <div className="text-[10px] truncate"><span className="text-slate-400">Supplier:</span> {row.supplierShortCode || "SSSSS"}</div>
                    </div>
                ) : (
                    <span className="text-xs text-slate-500 font-medium">Coparity</span>
                )}
            </td>
            {/* ── Provenance ── */}
            <td className="px-3 py-3">
                {row.basedOn
                    ? <span className="flex items-start gap-1 text-[11px] text-slate-400"><GitBranch className="w-3 h-3 shrink-0 text-slate-300 mt-0.5" /><span className="break-all">{row.basedOn}</span></span>
                    : <span className="text-[11px] text-slate-300">—</span>}
            </td>
            {/* ── Updated ── */}
            <td className="px-3 py-3 whitespace-nowrap">
                <span className="text-[11px] text-slate-400">{formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })}</span>
            </td>
            {/* ── Actions ── */}
            <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {tab === "working-copy"
                        ? <WCActions id={row.id} onAddToLibrary={() => onAddToLibrary(row)} onArchive={() => onArchiveWC(row)} onDelete={() => onDeleteWC(row)} />
                        : tab === "reference"
                            ? <RefActions id={row.id} row={row} onCreateWC={() => onCreateWorkingCopy(row)} onVisibility={() => onVisibility(row)} onArchive={() => onArchiveRef(row)} onDelete={() => onDeleteRef(row)} />
                            : <OtherActions id={row.id} />}
                </div>
            </td>
        </tr>
    );
}

function RowIcon({ tab }: { tab: TabKey }) {
    if (tab === "reference") return <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-50 border border-amber-100 shrink-0 mt-0.5"><BookMarked className="w-3.5 h-3.5 text-amber-600" /></div>;
    if (tab === "working-copy") return <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-50 border border-blue-100 shrink-0 mt-0.5"><FileEdit className="w-3.5 h-3.5 text-blue-500" /></div>;
    return <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-50 border border-slate-200 shrink-0 mt-0.5"><Box className="w-3.5 h-3.5 text-slate-500" /></div>;
}

export function StatusPill({ status }: { status: string }) {
    if (!status || status === "ACTIVE") return null;
    const cls: Record<string, string> = { DRAFT: "bg-slate-100 text-slate-500", DIGITIZING: "bg-blue-50 text-blue-600", ERROR: "bg-red-50 text-red-500", UPLOADED: "bg-slate-100 text-slate-400" };
    return <span className={cn("text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0", cls[status] ?? "bg-slate-100 text-slate-400")}>{status.toLowerCase()}</span>;
}

export function VisibilityPill({ state }: { state: "PRIVATE" | "RESTRICTED" | "GLOBAL" }) {
    if (state === "GLOBAL") return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
            <Globe className="w-2.5 h-2.5" />Global
        </span>
    );
    if (state === "RESTRICTED") return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
            <Eye className="w-2.5 h-2.5" />Restricted
        </span>
    );
    return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
            <Lock className="w-2.5 h-2.5" />Private
        </span>
    );
}

/** @deprecated Use VisibilityPill instead. */
export const SharingPill = VisibilityPill;

function WCActions({ id, onAddToLibrary, onArchive, onDelete }: { id: string; onAddToLibrary: () => void; onArchive: () => void; onDelete: () => void }) {
    return (<>
        <Link href={`/app/admin/questionnaires/${id}`} title="Open in Editor" className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors">Open</Link>
        <button onClick={onAddToLibrary} title="Publish Working Copy to Reference Library" className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors whitespace-nowrap">Publish</button>
        <button onClick={onArchive} className="p-1 rounded border border-slate-200 hover:border-amber-300 text-slate-400 hover:text-amber-600 transition-colors" title="Archive Working Copy"><Archive className="w-3 h-3" /></button>
        <button onClick={onDelete} className="p-1 rounded border border-slate-200 hover:border-red-300 text-slate-400 hover:text-red-500 transition-colors" title="Delete Working Copy"><Trash2 className="w-3 h-3" /></button>
    </>);
}

function RefActions({ id, row, onCreateWC, onVisibility, onArchive, onDelete }: { id: string; row: QV2Row; onCreateWC: () => void; onVisibility: () => void; onArchive: () => void; onDelete: () => void }) {
    const canDelete = row.descendantCount === 0;
    return (<>
        <Link href={`/app/admin/questionnaires/${id}`} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors">View</Link>
        <button onClick={onCreateWC} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors whitespace-nowrap">Working Copy</button>
        <button onClick={onVisibility} title="Visibility" className="text-[11px] text-slate-600 hover:text-slate-900 p-1 rounded border border-slate-200 hover:border-slate-300 transition-colors"><Eye className="w-3 h-3" /></button>
        <button onClick={onArchive} className="p-1 rounded border border-slate-200 hover:border-amber-300 text-slate-400 hover:text-amber-600 transition-colors" title="Archive Snapshot"><Archive className="w-3 h-3" /></button>
        <button
            onClick={canDelete ? onDelete : undefined}
            disabled={!canDelete}
            title={canDelete ? "Delete Snapshot" : "Cannot delete: this snapshot has been used to create other questionnaires"}
            className={cn("p-1 rounded border transition-colors",
                canDelete ? "border-slate-200 hover:border-red-300 text-slate-400 hover:text-red-500" : "border-slate-100 text-slate-200 cursor-not-allowed"
            )}
        >
            <Trash2 className="w-3 h-3" />
        </button>
    </>);
}

function OtherActions({ id }: { id: string }) {
    return <Link href={`/app/admin/questionnaires/${id}`} className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors">View</Link>;
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ tab }: { tab: TabKey }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                {tab === "reference" ? <BookMarked className="w-4 h-4 text-slate-300" /> : tab === "working-copy" ? <FileEdit className="w-4 h-4 text-slate-300" /> : <Box className="w-4 h-4 text-slate-300" />}
            </div>
            <p className="text-sm font-medium text-slate-500">{tab === "working-copy" ? "No working copies" : tab === "reference" ? "No reference library items" : "No other questionnaires"}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {tab === "working-copy" ? "Working copies appear here when questionnaires are in development." : tab === "reference" ? "Add a working copy to the library to create your first stable reference." : "Other questionnaires will appear here."}
            </p>
        </div>
    );
}

// ── Detail Panel Content (rendered inside Sheet in Explorer) ─────────────────
// This component renders the *content* only — the Sheet wrapper lives in Explorer.

export interface DetailPanelProps {
    row: QV2Row;
    onAddToLibrary: (r: QV2Row) => void;
    onCreateWorkingCopy: (r: QV2Row) => void;
    onVisibility: (r: QV2Row) => void;
    onArchiveWC: (r: QV2Row) => void;
    onDeleteWC: (r: QV2Row) => void;
    onArchiveRef: (r: QV2Row) => void;
    onDeleteRef: (r: QV2Row) => void;
}

export function DetailPanelContent({ row, onAddToLibrary, onCreateWorkingCopy, onVisibility, onArchiveWC, onDeleteWC, onArchiveRef, onDeleteRef }: DetailPanelProps) {
    const isRef = row.kind === "REFERENCE_SNAPSHOT";
    const canDeleteRef = row.descendantCount === 0;

    return (
        <div className="flex flex-col h-full">
            {/* Kind badge */}
            <div className="flex items-center gap-2 mb-4">
                {isRef
                    ? <BookMarked className="w-4 h-4 text-amber-600" />
                    : row.kind === "WORKING_COPY"
                        ? <FileEdit className="w-4 h-4 text-blue-500" />
                        : <Box className="w-4 h-4 text-slate-500" />}
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {isRef ? "Reference Snapshot" : row.kind === "WORKING_COPY" ? "Working Copy" : "Questionnaire"}
                </span>
            </div>

            {/* Header card */}
            <div className={cn("rounded-lg border px-4 py-3 mb-4", isRef ? "bg-amber-50/50 border-amber-100" : row.kind === "WORKING_COPY" ? "bg-blue-50/40 border-blue-100" : "bg-slate-50 border-slate-200")}>
                <p className={cn("font-mono text-xs font-semibold break-all leading-relaxed", isRef ? "text-amber-900" : "text-slate-800")}>{row.name}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <StatusPill status={row.status} />
                    {isRef && row.sharingState && <SharingPill state={row.sharingState} />}
                </div>
            </div>

            {/* Metadata rows */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
                <div className="divide-y divide-slate-100">
                    <DrawerRow label="Func Code" value={row.functionalCode
                        ? <span className="font-mono bg-slate-100 px-1 rounded text-slate-600 text-xs">{row.functionalCode}</span>
                        : <span className="text-amber-500 flex items-center gap-1 justify-end text-xs"><AlertTriangle className="w-3 h-3" /> Missing</span>} />
                    <DrawerRow label="Ref Code" value={row.referenceCode
                        ? <span className="font-mono text-[10px] text-slate-500 break-all">{row.referenceCode}</span>
                        : isRef
                            ? <span className="text-amber-500 flex items-center gap-1 justify-end text-xs"><AlertTriangle className="w-3 h-3" /> Missing</span>
                            : <span className="text-slate-300 italic text-[11px]">N/A</span>} />
                    <DrawerRow label="Questions" value={row.questionCount > 0
                        ? <span className="flex items-center gap-1 justify-end"><Hash className="w-3 h-3 text-slate-300" />{row.questionCount}</span>
                        : "—"} />
                    {isRef && <DrawerRow label="Derived" value={row.descendantCount > 0
                        ? <span className="text-[11px] text-slate-600">{row.descendantCount} questionnaire{row.descendantCount !== 1 ? "s" : ""}</span>
                        : <span className="text-[11px] text-slate-300 italic">None</span>} />}
                    <DrawerRow label="Owner" value={row.isCoparityOwned ? "Coparity" : (row.ownerOrgName || "Unknown")} />
                    {!row.isCoparityOwned && row.kind === "ENGAGEMENT_QUESTIONNAIRE" && (<>
                        <DrawerRow label="Client LE" value={row.clientLeShortCode || "XXXXX"} />
                        <DrawerRow label="Supplier" value={row.supplierShortCode || "SSSSS"} />
                    </>)}
                    <DrawerRow label="Based on" value={row.basedOn
                        ? <span className="flex items-start gap-1 text-right"><GitBranch className="w-3 h-3 text-slate-300 shrink-0 mt-0.5" /><span className="break-all text-[11px]">{row.basedOn}</span></span>
                        : <span className="text-slate-300 italic text-[11px]">No lineage</span>} />
                    <DrawerRow label="Updated" value={formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })} />
                    <DrawerRow label="Created" value={format(new Date(row.createdAt), "d MMM yyyy")} />
                    {row.hasFile && <DrawerRow label="File" value={<span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">attached</span>} />}
                </div>
            </div>

            {isRef && (
                <div className="px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-700 leading-relaxed mb-4">
                    Read-only. To make changes, create a working copy and publish a new snapshot.
                </div>
            )}

            {/* Actions */}
            <div className="space-y-1.5 mt-auto">
                {isRef && row.isCoparityOwned ? (<>
                    <Link href={`/app/admin/questionnaires/${row.id}`} className="flex items-center justify-between w-full text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                        View questionnaire <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button onClick={() => onCreateWorkingCopy(row)} className="flex items-center justify-between w-full text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded border border-blue-200 hover:border-blue-300 transition-colors">
                        Create Working Copy <ArrowRight className="w-3 h-3" />
                    </button>
                    <button onClick={() => onVisibility(row)} className="flex items-center justify-between w-full text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                        Set Visibility <Eye className="w-3 h-3" />
                    </button>
                    <button onClick={() => onArchiveRef(row)} className="flex items-center justify-between w-full text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-3 py-2 rounded border border-amber-100 hover:border-amber-200 transition-colors">
                        Archive Snapshot <Archive className="w-3 h-3" />
                    </button>
                    <button
                        onClick={canDeleteRef ? () => onDeleteRef(row) : undefined}
                        disabled={!canDeleteRef}
                        title={!canDeleteRef ? "Cannot delete: has been used to create other questionnaires" : undefined}
                        className={cn("flex items-center justify-between w-full text-xs px-3 py-2 rounded border transition-colors",
                            canDeleteRef ? "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100 hover:border-red-200" : "text-slate-300 border-slate-100 cursor-not-allowed"
                        )}
                    >
                        Delete Snapshot <Trash2 className="w-3 h-3" />
                    </button>
                </>) : row.kind === "WORKING_COPY" && row.isCoparityOwned ? (<>
                    <Link href={`/app/admin/questionnaires/${row.id}`} className="flex items-center justify-between w-full text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                        Open editor <ChevronRight className="w-3 h-3" />
                    </Link>
                    <button onClick={() => onAddToLibrary(row)} className="flex items-center justify-between w-full text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded border border-amber-200 hover:border-amber-300 transition-colors">
                        Publish to Reference Library <BookMarked className="w-3 h-3" />
                    </button>
                    <button onClick={() => onArchiveWC(row)} className="flex items-center justify-between w-full text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-3 py-2 rounded border border-amber-100 hover:border-amber-200 transition-colors">
                        Archive Working Copy <Archive className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteWC(row)} className="flex items-center justify-between w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded border border-red-100 hover:border-red-200 transition-colors">
                        Delete Working Copy <Trash2 className="w-3 h-3" />
                    </button>
                </>) : (
                    <Link href={`/app/admin/questionnaires/${row.id}`} className="flex items-center justify-between w-full text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                        View <ExternalLink className="w-3 h-3" />
                    </Link>
                )}
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
