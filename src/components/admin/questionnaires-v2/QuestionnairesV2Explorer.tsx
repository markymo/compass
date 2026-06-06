"use client";

import { useState, useEffect, useTransition } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import { QV2Row, SharingState, addToReferenceLibrary, createWorkingCopy, updateSharingState, previewPublishReferenceSnapshot, archiveWorkingCopy, deleteWorkingCopy, archiveReferenceSnapshot, deleteReferenceSnapshot } from "@/actions/questionnaires-v2";
import { createManualQuestionnaire } from "@/actions/questionnaire";
import { generateReferenceCodePrefix, normalizeCode, generateWorkingCopyTitle } from "@/lib/questionnaires/reference-codes";
import { BookMarked, BookOpen, PenLine, Loader2, Globe, Lock, Plus, Upload, Info, Share2, FileText, ArrowDown, Pencil, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExplorerTable, DetailDrawer, EmptyState } from "./ExplorerComponents";

type TabKey = "working-copy" | "reference" | "other";

interface Props {
    data: { workingCopies: QV2Row[]; referenceLibrary: QV2Row[]; other: QV2Row[] };
    initialTab: TabKey;
}

export function QuestionnairesV2Explorer({ data, initialTab }: Props) {
    const router = useRouter();
    const [tab, setTabState] = useState<TabKey>(initialTab);
    const [selected, setSelected] = useState<QV2Row | null>(null);
    const [confirmAddToLib, setConfirmAddToLib] = useState<QV2Row | null>(null);
    const [confirmCreateWC, setConfirmCreateWC] = useState<QV2Row | null>(null);
    const [confirmShare, setConfirmShare] = useState<QV2Row | null>(null);
    const [confirmArchiveWC, setConfirmArchiveWC] = useState<QV2Row | null>(null);
    const [confirmDeleteWC, setConfirmDeleteWC] = useState<QV2Row | null>(null);
    const [confirmArchiveRef, setConfirmArchiveRef] = useState<QV2Row | null>(null);
    const [confirmDeleteRef, setConfirmDeleteRef] = useState<QV2Row | null>(null);
    const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
    const [pendingSelectTab, setPendingSelectTab] = useState<TabKey | null>(null);
    const [showNewWCDialog, setShowNewWCDialog] = useState(false);

    useEffect(() => {
        if (!pendingSelectId || !pendingSelectTab) return;
        const list = pendingSelectTab === "reference" ? data.referenceLibrary : pendingSelectTab === "working-copy" ? data.workingCopies : data.other;
        const found = list.find(r => r.id === pendingSelectId);
        if (found) {
            setTabState(pendingSelectTab);
            setSelected(found);
            setPendingSelectId(null);
            setPendingSelectTab(null);
        }
    }, [data.referenceLibrary, data.workingCopies, data.other, pendingSelectId, pendingSelectTab]);

    const rows = tab === "working-copy" ? data.workingCopies : tab === "reference" ? data.referenceLibrary : data.other;

    function setTab(t: TabKey) {
        setTabState(t);
        setSelected(null);
        router.push(`/app/admin/questionnaires-v2?tab=${t}`);
    }

    function selectRow(row: QV2Row) {
        setSelected(prev => prev?.id === row.id ? null : row);
    }

    function afterAction(newId: string, targetTab: TabKey) {
        setPendingSelectId(newId);
        setPendingSelectTab(targetTab);
        setSelected(null);
        setTabState(targetTab);
        router.push(`/app/admin/questionnaires-v2?tab=${targetTab}`);
        router.refresh();
    }

    return (
        <>
            <div className="flex gap-0 min-h-0">
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Questionnaires</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Working copies &amp; reference library</p>
                        </div>
                        <TopAction tab={tab} onNewWorkingCopy={() => setShowNewWCDialog(true)} />
                    </div>

                    <div className="flex items-center border-b border-slate-200 overflow-x-auto">
                        <TabButton label="Coparity Working Copies" count={data.workingCopies.length} active={tab === "working-copy"} onClick={() => setTab("working-copy")} />
                        <TabButton label="Coparity Reference Library" count={data.referenceLibrary.length} active={tab === "reference"} onClick={() => setTab("reference")} />
                        <TabButton label="Other Questionnaires" count={data.other.length} active={tab === "other"} onClick={() => setTab("other")} />
                    </div>

                    {tab === "reference" && <ReferenceLibraryInfo />}

                    <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg overflow-hidden">
                        {rows.length === 0
                            ? <EmptyState tab={tab} />
                            : <ExplorerTable rows={rows} tab={tab} selectedId={selected?.id ?? null} onSelect={selectRow}
                                onAddToLibrary={r => setConfirmAddToLib(r)}
                                onCreateWorkingCopy={r => setConfirmCreateWC(r)}
                                onShare={r => setConfirmShare(r)}
                                onArchiveWC={r => setConfirmArchiveWC(r)}
                                onDeleteWC={r => setConfirmDeleteWC(r)}
                                onArchiveRef={r => setConfirmArchiveRef(r)}
                                onDeleteRef={r => setConfirmDeleteRef(r)}
                            />
                        }
                    </div>
                </div>

                {selected && (
                    <DetailDrawer row={selected} onClose={() => setSelected(null)}
                        onAddToLibrary={r => setConfirmAddToLib(r)}
                        onCreateWorkingCopy={r => setConfirmCreateWC(r)}
                        onShare={r => setConfirmShare(r)}
                        onArchiveWC={r => setConfirmArchiveWC(r)}
                        onDeleteWC={r => setConfirmDeleteWC(r)}
                        onArchiveRef={r => setConfirmArchiveRef(r)}
                        onDeleteRef={r => setConfirmDeleteRef(r)}
                    />
                )}
            </div>

            {confirmAddToLib && (
                <ConfirmAddDialog row={confirmAddToLib} onCancel={() => setConfirmAddToLib(null)}
                    onSuccess={id => { setConfirmAddToLib(null); afterAction(id, "reference"); }} />
            )}
            {confirmCreateWC && (
                <ConfirmCreateWCDialog row={confirmCreateWC} onCancel={() => setConfirmCreateWC(null)}
                    onSuccess={id => { setConfirmCreateWC(null); afterAction(id, "working-copy"); }} />
            )}
            {confirmShare && (
                <ShareDialog row={confirmShare} onCancel={() => setConfirmShare(null)}
                    onSuccess={() => { setConfirmShare(null); setPendingSelectId(confirmShare.id); setPendingSelectTab("reference"); setSelected(null); router.refresh(); }} />
            )}
            {confirmArchiveWC && (
                <ConfirmArchiveDialog
                    kind="working-copy"
                    row={confirmArchiveWC}
                    onCancel={() => setConfirmArchiveWC(null)}
                    onSuccess={() => { setConfirmArchiveWC(null); setSelected(null); router.refresh(); }}
                />
            )}
            {confirmDeleteWC && (
                <ConfirmDeleteDialog
                    kind="working-copy"
                    row={confirmDeleteWC}
                    onCancel={() => setConfirmDeleteWC(null)}
                    onSuccess={() => { setConfirmDeleteWC(null); setSelected(null); router.refresh(); }}
                />
            )}
            {confirmArchiveRef && (
                <ConfirmArchiveDialog
                    kind="reference"
                    row={confirmArchiveRef}
                    onCancel={() => setConfirmArchiveRef(null)}
                    onSuccess={() => { setConfirmArchiveRef(null); setSelected(null); router.refresh(); }}
                />
            )}
            {confirmDeleteRef && (
                <ConfirmDeleteDialog
                    kind="reference"
                    row={confirmDeleteRef}
                    onCancel={() => setConfirmDeleteRef(null)}
                    onSuccess={() => { setConfirmDeleteRef(null); setSelected(null); router.refresh(); }}
                />
            )}
            {showNewWCDialog && (
                <NewWorkingCopyDialog
                    onCancel={() => setShowNewWCDialog(false)}
                    onSuccess={(id) => { setShowNewWCDialog(false); router.push(`/app/admin/questionnaires/${id}`); }}
                />
            )}
        </>
    );
}

// ── Dialogs ─────────────────────────────────────────────────────────────────

function ConfirmAddDialog({ row, onCancel, onSuccess }: { row: QV2Row; onCancel: () => void; onSuccess: (id: string) => void }) {
    const [isPending, startTransition] = useTransition();
    const [preview, setPreview] = React.useState<{ sourceName: string; proposedReferenceCode: string; proposedSnapshotName: string; nextVersion: number } | null>(null);
    const [previewError, setPreviewError] = React.useState<string | null>(null);

    // Load the preview as soon as the dialog mounts
    React.useEffect(() => {
        let cancelled = false;
        previewPublishReferenceSnapshot(row.id).then(res => {
            if (cancelled) return;
            if (res.success && res.preview) {
                setPreview(res.preview);
            } else {
                setPreviewError(res.error ?? "Could not compute preview.");
            }
        });
        return () => { cancelled = true; };
    }, [row.id]);

    function handle() {
        startTransition(async () => {
            const r = await addToReferenceLibrary(row.id);
            if (r.success && r.referenceId) {
                const label = r.snapshotReferenceCode ?? r.snapshotName ?? row.name;
                toast.success("Reference Snapshot created", { description: label });
                onSuccess(r.referenceId);
            } else {
                toast.error("Failed", { description: r.error });
                onCancel();
            }
        });
    }

    return (
        <DialogShell onBackdropClick={!isPending ? onCancel : undefined}>
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                    <BookMarked className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Publish to Reference Library</h2>
                    <p className="text-xs text-slate-500 mt-0.5">This creates a locked, versioned snapshot.</p>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="px-5 pt-5 pb-4">
                {preview ? (
                    <div className="space-y-1">
                        {/* ── Creating card (top — emphasis) ── */}
                        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Creating Reference Snapshot</p>
                            <p className="font-mono text-[11px] font-semibold text-slate-900 break-all leading-relaxed">{preview.proposedSnapshotName}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                                <Lock className="w-3 h-3 text-emerald-600" />
                                <span className="text-[10px] font-semibold text-emerald-700">Read Only</span>
                                <span className="mx-1 text-emerald-200">·</span>
                                <span className="text-[10px] text-emerald-600">v{preview.nextVersion}</span>
                            </div>
                        </div>

                        {/* ── Arrow ── */}
                        <div className="flex items-center justify-center py-1">
                            <div className="flex flex-col items-center gap-0.5">
                                <ArrowDown className="w-3.5 h-3.5 text-slate-300" />
                                <span className="text-[10px] text-slate-400 font-medium">published from</span>
                            </div>
                        </div>

                        {/* ── Source card (bottom — provenance) ── */}
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Working Copy</p>
                            <p className="font-mono text-[11px] text-slate-600 break-all leading-relaxed">{preview.sourceName}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                                <Pencil className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] text-slate-500">Remains editable</span>
                            </div>
                        </div>

                        {/* ── Concise bullets ── */}
                        <div className="pt-3 space-y-1">
                            {[
                                "Working Copy remains editable",
                                "Future changes will not affect this Snapshot",
                                "Engagements should use the Snapshot, not the Working Copy",
                            ].map((item, i) => (
                                <p key={i} className="text-[11px] text-slate-400 leading-relaxed">
                                    <span className="text-emerald-500 font-bold mr-1">✓</span>{item}
                                </p>
                            ))}
                        </div>
                    </div>
                ) : previewError ? (
                    <p className="text-xs text-red-600">{previewError}</p>
                ) : (
                    <div className="flex items-center gap-2 py-6 justify-center">
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                        <span className="text-xs text-slate-400">Computing snapshot preview…</span>
                    </div>
                )}
            </div>

            <DialogFooter
                onCancel={onCancel}
                onConfirm={handle}
                isPending={isPending}
                confirmLabel="Publish Reference Snapshot"
                disabled={!preview || !!previewError}
            />
        </DialogShell>
    );
}

function ConfirmCreateWCDialog({ row, onCancel, onSuccess }: { row: QV2Row; onCancel: () => void; onSuccess: (id: string) => void }) {
    const [isPending, startTransition] = useTransition();
    function handle() {
        startTransition(async () => {
            const r = await createWorkingCopy(row.id);
            if (r.success && r.workingCopyId) {
                toast.success("Working Copy created", { description: `"${row.name}" is now an editable working copy.` });
                onSuccess(r.workingCopyId);
            } else {
                toast.error("Failed", { description: r.error });
                onCancel();
            }
        });
    }
    return (
        <DialogShell onBackdropClick={!isPending ? onCancel : undefined}>
            <DialogHeader icon={<PenLine className="w-4 h-4 text-blue-500" />} iconBg="bg-blue-50 border-blue-100" title="Create Working Copy" description={<>Creates a new editable working copy from <strong>&ldquo;{row.name}&rdquo;</strong>.</>} />
            <DialogBullets items={["The original reference remains read-only.", "Questions and mappings are copied.", "Answers, comments and evidence are not copied."]} />
            <DialogFooter onCancel={onCancel} onConfirm={handle} isPending={isPending} confirmLabel="Create Working Copy" />
        </DialogShell>
    );
}

function ConfirmArchiveDialog({ kind, row, onCancel, onSuccess }: { kind: "working-copy" | "reference"; row: QV2Row; onCancel: () => void; onSuccess: () => void }) {
    const [isPending, startTransition] = useTransition();
    const label = kind === "reference" ? "Reference Snapshot" : "Working Copy";
    function handle() {
        startTransition(async () => {
            const r = kind === "reference"
                ? await archiveReferenceSnapshot(row.id)
                : await archiveWorkingCopy(row.id);
            if (r.success) {
                toast.success(`${label} archived`, { description: row.name });
                onSuccess();
            } else {
                toast.error("Failed", { description: r.error });
                onCancel();
            }
        });
    }
    return (
        <DialogShell onBackdropClick={!isPending ? onCancel : undefined}>
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                    <Archive className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Archive {label}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Hidden from normal views. Can be restored later.</p>
                </div>
            </div>
            <div className="px-5 pt-4 pb-2 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                    <p className="font-mono text-[11px] text-slate-700 break-all leading-relaxed">{row.name}</p>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    The record is retained in the database. Lineage links from derived questionnaires are preserved.
                </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3">
                <button onClick={onCancel} disabled={isPending} className="text-xs font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handle} disabled={isPending} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                    {isPending ? "Archiving…" : `Archive ${label}`}
                </button>
            </div>
        </DialogShell>
    );
}

function ConfirmDeleteDialog({ kind, row, onCancel, onSuccess }: { kind: "working-copy" | "reference"; row: QV2Row; onCancel: () => void; onSuccess: () => void }) {
    const [isPending, startTransition] = useTransition();
    const label = kind === "reference" ? "Reference Snapshot" : "Working Copy";
    function handle() {
        startTransition(async () => {
            const r = kind === "reference"
                ? await deleteReferenceSnapshot(row.id)
                : await deleteWorkingCopy(row.id);
            if (r.success) {
                toast.success(`${label} deleted`, { description: row.name });
                onSuccess();
            } else {
                toast.error("Failed", { description: r.error });
                onCancel();
            }
        });
    }
    return (
        <DialogShell onBackdropClick={!isPending ? onCancel : undefined}>
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Delete {label}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Removed from all views. The database record is retained for lineage.</p>
                </div>
            </div>
            <div className="px-5 pt-4 pb-2 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                    <p className="font-mono text-[11px] text-slate-700 break-all leading-relaxed">{row.name}</p>
                </div>
                <p className="text-[11px] text-red-600 leading-relaxed font-medium">
                    This action cannot be undone from the UI.
                </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3">
                <button onClick={onCancel} disabled={isPending} className="text-xs font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handle} disabled={isPending} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {isPending ? "Deleting…" : `Delete ${label}`}
                </button>
            </div>
        </DialogShell>
    );
}

function ShareDialog({ row, onCancel, onSuccess }: { row: QV2Row; onCancel: () => void; onSuccess: () => void }) {
    const [state, setState] = useState<SharingState>(row.sharingState ?? "PRIVATE");
    const [isPending, startTransition] = useTransition();
    function handle() {
        startTransition(async () => {
            const r = await updateSharingState(row.id, state);
            if (r.success) {
                const labels: Record<SharingState, string> = {
                    PRIVATE: "Reference is now private to owner",
                    RESTRICTED: "Reference sharing is restricted",
                    GLOBAL: "Reference is now visible to all CoParity users",
                };
                toast.success(labels[state]);
                onSuccess();
            } else {
                toast.error("Failed", { description: r.error });
            }
        });
    }

    const options: { value: SharingState; icon: React.ReactNode; label: string; description: string }[] = [
        { value: "PRIVATE",    icon: <Lock className="w-4 h-4 text-slate-400 shrink-0" />,   label: "Private to Owner",    description: "Only visible within your organisation" },
        { value: "RESTRICTED", icon: <Share2 className="w-4 h-4 text-amber-500 shrink-0" />,  label: "Restricted Sharing",  description: "Shared with specific organisations only" },
        { value: "GLOBAL",     icon: <Globe className="w-4 h-4 text-emerald-500 shrink-0" />, label: "Global",              description: "Visible to all CoParity users" },
    ];

    return (
        <DialogShell onBackdropClick={!isPending ? onCancel : undefined}>
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Sharing</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control who can access this Reference Library item.</p>
            </div>
            <div className="px-5 pt-4 pb-4 space-y-2">
                {options.map(opt => (
                    <button key={opt.value} onClick={() => setState(opt.value)} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors", state === opt.value ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300")}>
                        {opt.icon}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800">{opt.label}</p>
                            <p className="text-[11px] text-slate-400">{opt.description}</p>
                        </div>
                        {state === opt.value && <div className="w-2 h-2 rounded-full bg-slate-900 shrink-0" />}
                    </button>
                ))}
            </div>
            <DialogFooter onCancel={onCancel} onConfirm={handle} isPending={isPending} confirmLabel="Save" />
        </DialogShell>
    );
}

// ── Dialog primitives ────────────────────────────────────────────────────────

function DialogShell({ children, onBackdropClick }: { children: React.ReactNode; onBackdropClick?: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onBackdropClick} />
            <div className="relative bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm">{children}</div>
        </div>
    );
}

function DialogHeader({ icon, iconBg, title, description }: { icon: React.ReactNode; iconBg: string; title: string; description: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
            <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5", iconBg)}>{icon}</div>
            <div>
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
            </div>
        </div>
    );
}

function DialogBullets({ items }: { items: string[] }) {
    return (
        <div className="mx-5 mb-4 bg-slate-50 border border-slate-100 rounded-lg px-4 py-3 space-y-1.5">
            {items.map((item, i) => <p key={i} className="text-[11px] text-slate-600 leading-relaxed"><span className="font-semibold">✓</span> {item}</p>)}
        </div>
    );
}

function DialogFooter({ onCancel, onConfirm, isPending, confirmLabel, disabled }: { onCancel: () => void; onConfirm: () => void; isPending: boolean; confirmLabel: string; disabled?: boolean }) {
    return (
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
            <button onClick={onCancel} disabled={isPending} className="text-xs font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={onConfirm} disabled={isPending || disabled} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                {isPending ? "Working…" : confirmLabel}
            </button>
        </div>
    );
}

// ── Tab / header primitives ──────────────────────────────────────────────────

function TopAction({ tab, onNewWorkingCopy }: { tab: TabKey; onNewWorkingCopy: () => void }) {
    return tab === "working-copy"
        ? <button onClick={onNewWorkingCopy} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700 transition-colors"><Plus className="w-3.5 h-3.5" />New Working Copy</button>
        : <button disabled className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 opacity-50 cursor-not-allowed"><Upload className="w-3.5 h-3.5" />Add Working Copy</button>;
}

function TabButton({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} className={cn("relative px-5 py-2.5 text-sm font-medium transition-colors select-none focus-visible:outline-none", active ? "text-slate-900 border-b-2 border-slate-900 -mb-px" : "text-slate-500 hover:text-slate-700 border-b-2 border-transparent -mb-px")}>
            {label}
            {count !== undefined && <span className={cn("ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full", active ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400")}>{count}</span>}
        </button>
    );
}

function ReferenceLibraryInfo() {
    return (
        <div className="bg-slate-50 border border-slate-200 border-b-0 px-5 py-3">
            <div className="flex items-start gap-2 max-w-2xl">
                <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-600">Reference Library items are read-only.</span>{" "}
                    They are stable, frozen points that can be shared or used as the basis for new working copies. To make changes, create a working copy and add a revised version here.
                </p>
            </div>
        </div>
    );
}

// ── New Working Copy creation dialog ────────────────────────────────────────

function NewWorkingCopyDialog({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: (id: string) => void }) {
    const [funcCodeRaw, setFuncCodeRaw] = React.useState("");
    const [isPending, startTransition] = React.useTransition();
    const [error, setError] = React.useState<string | null>(null);

    const functionalCode = normalizeCode(funcCodeRaw);
    const generatedName = functionalCode 
        ? generateWorkingCopyTitle({ functionalCode, isSystemQuestionnaire: true }) 
        : "";
    const previewText = functionalCode 
        ? generatedName 
        : "Enter a functional code to preview";

    function handle() {
        if (!functionalCode) { setError("A functional code is required."); return; }
        setError(null);
        startTransition(async () => {
            const r = await createManualQuestionnaire({
                name: generatedName,
                functionalCode,
                // Provide a minimal first question so the action's non-empty guard passes;
                // the admin will edit content in the mapper immediately after creation.
                questions: "Enter your first question here",
                isGlobal: false,
            });
            if (r.success && r.id) {
                toast.success("Working Copy created", { description: `"${generatedName}" is ready to edit.` });
                onSuccess(r.id);
            } else {
                setError(r.error || "Failed to create working copy.");
            }
        });
    }

    return (
        <DialogShell onBackdropClick={!isPending ? onCancel : undefined}>
            <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">New Working Copy</h2>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Creates an editable working copy. Publish it to the Reference Library when it's ready for assignment.</p>
                </div>
            </div>
            <div className="px-5 pt-4 pb-4">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Functional Code</label>
                <input
                    autoFocus
                    value={funcCodeRaw}
                    onChange={e => { setFuncCodeRaw(e.target.value); setError(null); }}
                    onKeyDown={e => e.key === "Enter" && functionalCode && handle()}
                    placeholder="e.g. FMSB UK"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-colors uppercase"
                    disabled={isPending}
                />
                <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Preview</label>
                    <div className={cn("font-mono text-xs break-all", functionalCode ? "text-slate-600 font-medium" : "text-slate-400 italic")}>
                        {previewText}
                    </div>
                </div>
                {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
                <p className="text-[11px] text-slate-400 mt-3">You will be taken to the editor to add questions and mappings.</p>
            </div>
            <DialogFooter onCancel={onCancel} onConfirm={handle} isPending={isPending} confirmLabel="Create Working Copy" disabled={!functionalCode} />
        </DialogShell>
    );
}
