"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, MessageSquare, Trash2, Download, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

type Note = {
    id: string;
    pageUrl: string;
    note: string;
    category: string;
    authorEmail: string | null;
    sessionTag: string | null;
    createdAt: Date;
};

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    bug: { icon: <Bug className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-700 border-red-200", label: "Bug" },
    feature: { icon: <Lightbulb className="h-3.5 w-3.5" />, color: "bg-amber-100 text-amber-700 border-amber-200", label: "Feature" },
    general: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-600 border-slate-200", label: "Note" },
};

export function FeedbackAdminClient({ sessions }: { sessions: Record<string, Note[]> }) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const allNotes = Object.values(sessions).flat();

    async function handleDelete(id: string) {
        await fetch(`/api/feedback?id=${id}`, { method: "DELETE" });
        startTransition(() => router.refresh());
    }

    function exportCSV() {
        const rows = [["Session", "Category", "Page URL", "Note", "Created At"]];
        allNotes.forEach(n => {
            rows.push([
                n.sessionTag || "",
                n.category,
                n.pageUrl,
                n.note.replace(/"/g, '""'),
                new Date(n.createdAt).toISOString()
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    }

    function exportMarkdown() {
        const lines: string[] = ["# Product Feedback Export\n"];
        for (const [sessionTag, notes] of Object.entries(sessions)) {
            lines.push(`## ${sessionTag}\n`);
            const bugs = notes.filter(n => n.category === "bug");
            const features = notes.filter(n => n.category === "feature");
            const general = notes.filter(n => n.category === "general");
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
                lines.push("");
            }
        }
        navigator.clipboard.writeText(lines.join("\n")).then(() => {
            alert("Markdown copied to clipboard!");
        });
    }

    if (allNotes.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No feedback notes yet. Notes will appear here when captured via the feedback widget.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Export Actions */}
            <div className="flex items-center justify-end gap-2">
                <button
                    onClick={exportMarkdown}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <FileText className="h-4 w-4 text-slate-500" />
                    Copy as Markdown
                </button>
                <button
                    onClick={exportCSV}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </button>
            </div>

            {/* Sessions */}
            {Object.entries(sessions).sort().map(([sessionTag, notes]) => {
                const isCollapsed = collapsed[sessionTag];
                return (
                    <div key={sessionTag} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {/* Session Header */}
                        <button
                            onClick={() => setCollapsed(prev => ({ ...prev, [sessionTag]: !isCollapsed }))}
                            className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                <span className="font-semibold text-slate-800">{sessionTag}</span>
                                <span className="text-sm text-slate-400">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                {notes.filter(n => n.category === "bug").length > 0 && (
                                    <span className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                                        <Bug className="h-3 w-3" /> {notes.filter(n => n.category === "bug").length}
                                    </span>
                                )}
                                {notes.filter(n => n.category === "feature").length > 0 && (
                                    <span className="flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                                        <Lightbulb className="h-3 w-3" /> {notes.filter(n => n.category === "feature").length}
                                    </span>
                                )}
                            </div>
                        </button>

                        {/* Notes Table */}
                        {!isCollapsed && (
                            <div className="divide-y divide-slate-100">
                                {notes.map(n => {
                                    const meta = CATEGORY_META[n.category] || CATEGORY_META.general;
                                    return (
                                        <div key={n.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 group/row transition-colors">
                                            <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium shrink-0 mt-0.5 ${meta.color}`}>
                                                {meta.icon} {meta.label}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-mono text-slate-400 truncate">{n.pageUrl}</p>
                                                <p className="text-sm text-slate-800 mt-0.5 leading-snug">{n.note}</p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 mt-0.5">
                                                <span className="text-[11px] text-slate-400">
                                                    {new Date(n.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                                <button
                                                    onClick={() => handleDelete(n.id)}
                                                    disabled={isPending}
                                                    className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
