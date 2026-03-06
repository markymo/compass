"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, MessageSquare, Trash2, Download, FileText, ChevronDown, ChevronRight, MessageSquarePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Note = {
    id: string;
    pageUrl: string;
    note: string;
    category: string;
    status: string;
    authorEmail: string | null;
    authorName: string | null;
    sessionTag: string | null;
    closedAt: Date | null;
    createdAt: Date;
    assignedToId: string | null;
    assignedTo: { id: string; name: string | null; email: string | null } | null;
};

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    bug: { icon: <Bug className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-700 border-red-200", label: "Bug" },
    feature: { icon: <Lightbulb className="h-3.5 w-3.5" />, color: "bg-amber-100 text-amber-700 border-amber-200", label: "Feature" },
    general: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-600 border-slate-200", label: "Note" },
};

export function FeedbackAdminClient({
    sessions,
    users,
    currentUser
}: {
    sessions: Record<string, Note[]>;
    users: { id: string; name: string | null; email: string | null }[];
    currentUser: { id: string; name: string | null; email: string | null } | null;
}) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [showClosed, setShowClosed] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [newCategory, setNewCategory] = useState("general");
    const [newAssigneeId, setNewAssigneeId] = useState(currentUser?.id || "");
    const [isSaving, setIsSaving] = useState(false);

    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const allNotes = Object.values(sessions).flat();

    async function handleCreateTicket(e: React.FormEvent) {
        e.preventDefault();
        if (!newNote.trim()) return;

        setIsSaving(true);
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pageUrl: "/app/admin/feedback (Manually Created)",
                    note: newNote.trim(),
                    category: newCategory,
                    authorEmail: currentUser?.email,
                    authorName: currentUser?.name,
                    assignedToId: newAssigneeId || null,
                    sessionTag: "Manual Ticket"
                })
            });

            if (!res.ok) throw new Error("Failed to create ticket");

            setNewNote("");
            setShowCreateForm(false);
            startTransition(() => router.refresh());
        } catch (err) {
            alert("Error creating ticket");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this feedback?")) return;
        const res = await fetch(`/api/feedback?id=${id}`, { method: "DELETE" });
        if (!res.ok) {
            alert("Failed to delete feedback");
            return;
        }
        startTransition(() => router.refresh());
    }

    async function handleToggleStatus(id: string, currentStatus: string) {
        const newStatus = currentStatus === "closed" ? "open" : "closed";
        const res = await fetch(`/api/feedback`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: newStatus })
        });

        if (!res.ok) {
            const data = await res.json();
            alert(`Failed to update: ${data.error || res.statusText}`);
            return;
        }

        startTransition(() => router.refresh());
    }

    function exportCSV() {
        const rows = [["Session", "Category", "Status", "Page URL", "Note", "Created At", "Closed At"]];
        allNotes.forEach((n: any) => {
            rows.push([
                n.sessionTag || "",
                n.category,
                n.status,
                n.pageUrl,
                n.note.replace(/"/g, '""'),
                new Date(n.createdAt).toISOString(),
                n.closedAt ? new Date(n.closedAt).toISOString() : ""
            ]);
        });
        const csv = rows.map((r: any) => r.map((c: any) => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    }

    function exportMarkdown() {
        const lines: string[] = ["# Product Feedback Export\n"];
        const openNotes = allNotes.filter((n: any) => n.status !== "closed");

        if (openNotes.length === 0) {
            lines.push("All clear! No open feedback notes.");
        } else {
            for (const [sessionTag, notes] of Object.entries(sessions)) {
                const openInSession = notes.filter((n: any) => n.status !== "closed");
                if (openInSession.length === 0) continue;

                lines.push(`## ${sessionTag}\n`);
                const bugs = openInSession.filter((n: any) => n.category === "bug");
                const features = openInSession.filter((n: any) => n.category === "feature");
                const general = openInSession.filter((n: any) => n.category === "general");
                if (bugs.length) {
                    lines.push("### 🐛 Open Bugs");
                    bugs.forEach((n: any) => lines.push(`- [ ] \`${n.pageUrl}\` — ${n.note}`));
                    lines.push("");
                }
                if (features.length) {
                    lines.push("### 💡 Open Feature Requests");
                    features.forEach((n: any) => lines.push(`- [ ] \`${n.pageUrl}\` — ${n.note}`));
                    lines.push("");
                }
                if (general.length) {
                    lines.push("### 📝 Open Notes");
                    general.forEach((n: any) => lines.push(`- [ ] \`${n.pageUrl}\` — ${n.note}`));
                    lines.push("");
                }
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
            {/* Create Ticket Form */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <MessageSquarePlus className="h-5 w-5 text-indigo-600" />
                        <span className="font-semibold text-slate-800">Create New Ticket / Note</span>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${showCreateForm ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                        {showCreateForm ? 'Cancel' : '+ New Ticket'}
                    </div>
                </button>

                {showCreateForm && (
                    <form onSubmit={handleCreateTicket} className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Category</label>
                                <div className="flex gap-2">
                                    {(Object.keys(CATEGORY_META)).map((cat: any) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setNewCategory(cat)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${newCategory === cat ? 'bg-white border-indigo-500 text-indigo-700 shadow-sm ring-2 ring-indigo-500/10' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                        >
                                            {CATEGORY_META[cat as keyof typeof CATEGORY_META].icon}
                                            {CATEGORY_META[cat as keyof typeof CATEGORY_META].label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Assign To</label>
                                <select
                                    value={newAssigneeId}
                                    onChange={(e) => setNewAssigneeId(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">Unassigned</option>
                                    {users.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.name || u.email} {u.id === currentUser?.id ? '(Me)' : ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Ticket details</label>
                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Describe the bug, feature request or general note..."
                                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                rows={3}
                                required
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSaving || !newNote.trim()}
                                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
                                Create Ticket
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Export Actions */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowClosed(!showClosed)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showClosed
                            ? "bg-slate-100 text-slate-700 border-slate-300 shadow-inner"
                            : "bg-white text-slate-400 border-slate-200 hover:border-slate-300 shadow-sm"
                            }`}
                    >
                        {showClosed ? "Hide Closed Items" : "Show Closed Items"}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportMarkdown}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <FileText className="h-4 w-4 text-slate-500" />
                        Copy Open as MD
                    </button>
                    <button
                        onClick={exportCSV}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Sessions */}
            {Object.entries(sessions).sort().map(([sessionTag, notes]) => {
                const isCollapsed = collapsed[sessionTag];
                const filteredNotes = showClosed ? notes : notes.filter((n: any) => n.status !== 'closed');
                const openCount = notes.filter((n: any) => n.status !== "closed").length;

                if (filteredNotes.length === 0 && !showClosed) return null;

                return (
                    <div key={sessionTag} className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-opacity ${openCount === 0 ? "opacity-60" : ""}`}>
                        {/* Session Header */}
                        <button
                            onClick={() => setCollapsed(prev => ({ ...prev, [sessionTag]: !isCollapsed }))}
                            className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3">
                                {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                <span className={`font-semibold text-slate-800 ${openCount === 0 && !isCollapsed ? "line-through text-slate-400" : ""}`}>{sessionTag}</span>
                                <span className="text-sm text-slate-400">{notes.length} note{notes.length !== 1 ? "s" : ""} {openCount < notes.length && `(${openCount} open)`}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                {notes.filter((n: any) => n.category === "bug" && n.status !== "closed").length > 0 && (
                                    <span className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                                        <Bug className="h-3 w-3" /> {notes.filter((n: any) => n.category === "bug" && n.status !== "closed").length}
                                    </span>
                                )}
                            </div>
                        </button>

                        {/* Notes Table */}
                        {!isCollapsed && (
                            <div className="divide-y divide-slate-100">
                                {[...filteredNotes].sort((a: any, b: any) => (a.status === 'closed' ? 1 : -1)).map((n: any) => {
                                    const meta = CATEGORY_META[n.category] || CATEGORY_META.general;
                                    const isClosed = n.status === "closed";

                                    return (
                                        <div key={n.id} className={`flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 group/row transition-colors ${isClosed ? "bg-slate-50/50" : ""}`}>
                                            <button
                                                onClick={() => handleToggleStatus(n.id, n.status)}
                                                className={`mt-1.5 h-4 w-4 rounded border transition-colors flex items-center justify-center shrink-0 ${isClosed ? "bg-emerald-500 border-emerald-500 shadow-sm" : "border-slate-300 hover:border-emerald-500"}`}
                                            >
                                                {isClosed && <div className="h-2 w-2 bg-white rounded-full shadow-sm" />}
                                            </button>

                                            <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium shrink-0 mt-0.5 ${isClosed ? "bg-slate-100 text-slate-400 border-slate-200" : meta.color}`}>
                                                {meta.icon} {meta.label}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[11px] font-mono text-slate-400 truncate">{n.pageUrl}</p>
                                                    {n.authorName && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            Creator: <span className="font-semibold">{n.authorName}</span>
                                                        </span>
                                                    )}
                                                    {n.assignedTo && (
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-100">
                                                            Assigned: <span className="font-semibold">{n.assignedTo.name || n.assignedTo.email}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-sm mt-0.5 leading-snug ${isClosed ? "text-slate-400 line-through" : "text-slate-800"}`}>{n.note}</p>
                                                {isClosed && n.closedAt && (
                                                    <p className="text-[10px] text-emerald-600 font-medium mt-1">
                                                        Done at {new Date(n.closedAt).toLocaleDateString()} {new Date(n.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                )}
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
