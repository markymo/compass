"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquarePlus, X, Download, Trash2, ChevronDown, ChevronUp, Bug, Lightbulb, MessageSquare, Loader2 } from "lucide-react";

type Category = "bug" | "feature" | "general";

interface FeedbackNote {
    id: string;
    pageUrl: string;
    note: string;
    category: string;
    authorEmail?: string | null;
    sessionTag?: string | null;
    createdAt: string;
}

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode; color: string }> = {
    bug: {
        label: "Bug",
        icon: <Bug className="h-3.5 w-3.5" />,
        color: "bg-red-100 text-red-700 border-red-200"
    },
    feature: {
        label: "Feature",
        icon: <Lightbulb className="h-3.5 w-3.5" />,
        color: "bg-amber-100 text-amber-700 border-amber-200"
    },
    general: {
        label: "Note",
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        color: "bg-slate-100 text-slate-700 border-slate-200"
    }
};

function getToday() {
    return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getSessionTag() {
    return `Review ${getToday()}`;
}

export function FeedbackWidget() {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"add" | "view">("add");
    const [note, setNote] = useState("");
    const [category, setCategory] = useState<Category>("general");
    const [saving, setSaving] = useState(false);
    const [notes, setNotes] = useState<FeedbackNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [saved, setSaved] = useState(false);
    const sessionTag = getSessionTag();

    const fetchNotes = useCallback(async () => {
        setLoadingNotes(true);
        try {
            const res = await fetch(`/api/feedback?sessionTag=${encodeURIComponent(sessionTag)}`);
            const data = await res.json();
            setNotes(data.notes || []);
        } catch (e) {
            console.error("Failed to fetch feedback notes", e);
        } finally {
            setLoadingNotes(false);
        }
    }, [sessionTag]);

    useEffect(() => {
        if (open && tab === "view") {
            fetchNotes();
        }
    }, [open, tab, fetchNotes]);

    async function handleSubmit() {
        if (!note.trim()) return;
        setSaving(true);
        try {
            await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pageUrl: window.location.pathname + window.location.search,
                    note: note.trim(),
                    category,
                    sessionTag
                })
            });
            setNote("");
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.error("Failed to save feedback note", e);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        try {
            await fetch(`/api/feedback?id=${id}`, { method: "DELETE" });
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch (e) {
            console.error("Failed to delete feedback note", e);
        }
    }

    function exportMarkdown() {
        const bugs = notes.filter(n => n.category === "bug");
        const features = notes.filter(n => n.category === "feature");
        const general = notes.filter(n => n.category === "general");

        const lines: string[] = [`## ${sessionTag} — Feedback Export\n`];

        if (bugs.length) {
            lines.push("### 🐛 Bugs");
            bugs.forEach(n => lines.push(`- [ ] \`${n.pageUrl}\` — ${n.note}`));
            lines.push("");
        }
        if (features.length) {
            lines.push("### 💡 Feature Requests");
            features.forEach(n => lines.push(`- [ ] \`${n.pageUrl}\` — ${n.note}`));
            lines.push("");
        }
        if (general.length) {
            lines.push("### 📝 Notes");
            general.forEach(n => lines.push(`- [ ] \`${n.pageUrl}\` — ${n.note}`));
        }

        const md = lines.join("\n");
        navigator.clipboard.writeText(md).then(() => alert("Markdown copied to clipboard!"));
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
            {/* Panel */}
            {open && (
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[360px] flex flex-col overflow-hidden" style={{ maxHeight: "70vh" }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                            <span className="text-sm font-semibold text-slate-800">Feedback</span>
                            <span className="text-[10px] text-slate-400 font-medium">{sessionTag}</span>
                        </div>
                        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-100">
                        {(["add", "view"] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`flex-1 text-xs font-medium py-2 transition-colors ${tab === t ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                {t === "add" ? "Add Note" : `View All (${notes.length > 0 ? notes.length : "..."})`}
                            </button>
                        ))}
                    </div>

                    {/* Add Tab */}
                    {tab === "add" && (
                        <div className="flex flex-col gap-3 p-4">
                            <p className="text-[11px] text-slate-400">
                                <span className="font-semibold text-slate-600">Page:</span> {typeof window !== "undefined" ? window.location.pathname : ""}
                            </p>

                            {/* Category Selector */}
                            <div className="flex gap-2">
                                {(Object.keys(CATEGORY_META) as Category[]).map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border font-medium transition-all ${category === cat ? CATEGORY_META[cat].color + " ring-2 ring-offset-1 ring-current" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                                    >
                                        {CATEGORY_META[cat].icon}
                                        {CATEGORY_META[cat].label}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Describe the issue or idea..."
                                className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                rows={4}
                                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
                            />

                            <button
                                onClick={handleSubmit}
                                disabled={!note.trim() || saving}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? "✓ Saved!" : "Save Note"}
                                <span className="text-[10px] opacity-60">⌘↵</span>
                            </button>
                        </div>
                    )}

                    {/* View Tab */}
                    {tab === "view" && (
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                                {loadingNotes ? (
                                    <div className="flex items-center justify-center p-8 text-slate-400">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                ) : notes.length === 0 ? (
                                    <div className="flex items-center justify-center p-8 text-slate-400 text-sm">
                                        No notes yet for this session.
                                    </div>
                                ) : (
                                    notes.map(n => {
                                        const meta = CATEGORY_META[n.category as Category] || CATEGORY_META.general;
                                        return (
                                            <div key={n.id} className="p-3 hover:bg-slate-50 group/note transition-colors">
                                                <div className="flex items-start gap-2">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 mt-0.5 ${meta.color}`}>
                                                        {meta.icon}{meta.label}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] text-slate-400 truncate font-mono">{n.pageUrl}</p>
                                                        <p className="text-sm text-slate-800 mt-0.5 leading-snug">{n.note}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(n.id)}
                                                        className="shrink-0 opacity-0 group-hover/note:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {notes.length > 0 && (
                                <div className="p-3 border-t border-slate-100">
                                    <button
                                        onClick={exportMarkdown}
                                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                                    >
                                        <Download className="h-4 w-4" />
                                        Copy as Markdown Todo List
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Trigger Button */}
            <button
                onClick={() => { setOpen(!open); if (!open) setTab("add"); }}
                className="h-12 w-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                title="Product Feedback"
            >
                {open ? <X className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
            </button>
        </div>
    );
}
