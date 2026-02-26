import prisma from "@/lib/prisma";
import { Bug, Lightbulb, MessageSquare, Download } from "lucide-react";
import { FeedbackAdminClient } from "./client";

export default async function FeedbackAdminPage() {
    const notes = await prisma.feedbackNote.findMany({
        orderBy: [{ sessionTag: "asc" }, { createdAt: "desc" }]
    });

    // Group by session tag
    const sessions: Record<string, typeof notes> = {};
    for (const note of notes) {
        const key = note.sessionTag || "Untagged";
        if (!sessions[key]) sessions[key] = [];
        sessions[key].push(note);
    }

    const stats = {
        total: notes.length,
        open: notes.filter((n: any) => n.status !== "closed").length,
        done: notes.filter((n: any) => n.status === "closed").length,
        bugs: notes.filter((n: any) => n.category === "bug" && n.status !== "closed").length,
    };

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900">Product Feedback</h1>
                    <p className="text-slate-500 mt-1 text-sm">Notes captured during review sessions.</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: "Total Notes", value: stats.total, color: "text-slate-700 bg-slate-50 border-slate-200" },
                    { label: "Open Bugs", value: stats.bugs, icon: <Bug className="h-4 w-4 text-red-500" />, color: "text-red-700 bg-red-50 border-red-200" },
                    { label: "Done/Closed", value: stats.done, icon: <MessageSquare className="h-4 w-4 text-emerald-500" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Remaining Open", value: stats.open, icon: <Lightbulb className="h-4 w-4 text-amber-500" />, color: "text-amber-700 bg-amber-50 border-amber-200" },
                ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                        <div className="flex items-center gap-2 mb-1">
                            {s.icon}
                            <span className="text-xs font-medium opacity-70">{s.label}</span>
                        </div>
                        <div className="text-3xl font-bold">{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Pass data to client for download + interaction */}
            <FeedbackAdminClient sessions={sessions} />
        </div>
    );
}
