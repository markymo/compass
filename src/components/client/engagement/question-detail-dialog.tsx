"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, User, Send, History, MessageSquare, Sparkles } from "lucide-react";
import { QuestionTask } from "./question-card";
import { cn } from "@/lib/utils";

interface QuestionDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: QuestionTask | null;
}

import { updateAnswer, addComment } from "@/actions/kanban-actions";
import { toast } from "sonner";
import { useState, useEffect } from "react";

// ... existing imports

export function QuestionDetailDialog({ open, onOpenChange, task }: QuestionDetailDialogProps) {
    const [comment, setComment] = useState("");
    const [answer, setAnswer] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state when task opens
    useEffect(() => {
        if (task) {
            setAnswer(task.answer || "");
        }
    }, [task]);

    // Optimistic comments (initially from task, then local adds)
    const [localComments, setLocalComments] = useState<any[]>([]);

    useEffect(() => {
        if (task && task.comments) {
            setLocalComments(task.comments);
        } else {
            setLocalComments([]);
        }
    }, [task]);

    const handleSaveAnswer = async () => {
        if (!task) return;
        setIsSaving(true);
        const res = await updateAnswer(task.id, answer);
        if (res.success) {
            toast.success("Answer saved");
        } else {
            toast.error("Failed to save answer");
        }
        setIsSaving(false);
    };

    const handleSendComment = async () => {
        if (!task || !comment.trim()) return;

        // Optimistic add could go here, but let's wait for server for simplicity/correctness first
        const res = await addComment(task.id, comment);
        if (res.success && res.comment) {
            setLocalComments([...localComments, res.comment]);
            setComment("");
        } else {
            toast.error("Failed to send comment");
        }
    };

    if (!task) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[90vw] w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-white">{task.status}</Badge>
                            {task.hasFlag && <Badge variant="destructive">Flagged</Badge>}
                        </div>
                        <div className="flex items-center text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full font-medium border border-indigo-100" title="Updates will be saved to Legal Entity Knowledge Base">
                            <Bot className="h-3 w-3 mr-1.5" />
                            Synced to Knowledge Base
                        </div>
                    </div>
                    <DialogTitle className="text-xl leading-snug font-playfair">{task.question}</DialogTitle>
                    <DialogDescription className="mt-1">
                        Internal ID: {task.id.slice(0, 8)} • Assigned to {task.assignee?.name || 'Unassigned'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Answer & Details (Wait 60% approx) */}
                    <div className="flex-[3] p-8 overflow-y-auto border-r border-slate-100 bg-white">
                        <div className="space-y-8">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-slate-900">Proposed Answer</h4>
                                    <Button size="icon" variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-8 w-8" title="Auto-Generate with AI">
                                        <Sparkles className="h-5 w-5" />
                                    </Button>
                                </div>
                                <div className="relative">
                                    <Textarea
                                        className="min-h-[200px] text-base leading-relaxed p-4 bg-slate-50 border-slate-200 focus:bg-white transition-colors resize-y font-normal"
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        placeholder="Draft the official answer here..."
                                    />
                                    <div className="absolute bottom-4 right-4 flex gap-2">
                                        <Button size="sm" onClick={handleSaveAnswer} disabled={isSaving}>
                                            {isSaving ? "Saving..." : "Save Draft"}
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-2 text-right">
                                    Last auto-save: Just now
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Evidence Source</h4>
                                <div className="text-sm text-slate-600 space-y-2">
                                    <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 bg-white border rounded shadow-sm flex items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-red-500">PDF</span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 hover:text-indigo-600 cursor-pointer underline decoration-dotted">2023 Annual Report.pdf</p>
                                            <p className="text-xs text-slate-500">Page 4 • Paragraph 2</p>
                                            <p className="text-xs text-slate-500 italic mt-1 border-l-2 border-indigo-200 pl-2">
                                                "...the Legal Entity Identifier (LEI) for the company is 5493006MHB84DD0ZWV18..."
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Activity / Conversation (Wait 40% approx) */}
                    <div className="flex-[2] bg-slate-50 flex flex-col border-l border-slate-200">
                        <div className="p-4 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Discussion</h4>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-6">
                                {localComments.length === 0 && (
                                    <div className="text-center py-10">
                                        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <MessageSquare className="h-5 w-5 text-slate-300" />
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">No comments yet</p>
                                        <p className="text-xs text-slate-400">Start the conversation about this question.</p>
                                    </div>
                                )}
                                {localComments.map((c) => (
                                    <div key={c.id} className="flex gap-3">
                                        <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                                            <AvatarFallback className={cn("text-xs font-bold", c.type === 'AI' ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700")}>
                                                {c.type === 'AI' ? 'AI' : c.author.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-sm font-semibold text-slate-900">{c.author}</span>
                                                <span className="text-[10px] text-slate-400">{c.time}</span>
                                            </div>
                                            <div className="mt-1 text-sm text-slate-600 bg-white p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl border shadow-sm">
                                                {c.text}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <div className="p-4 bg-white border-t">
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Type your message..."
                                    className="min-h-[44px] max-h-[120px] resize-none bg-slate-50 focus:bg-white text-sm"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                                />
                                <Button size="icon" className="h-[44px] w-[44px] shrink-0" disabled={!comment.trim()} onClick={handleSendComment}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="hidden">
                    {/* Hiding default footer as we have inline actions */}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
