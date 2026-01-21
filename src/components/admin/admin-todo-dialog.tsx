"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, MessageSquare, Calendar as CalendarIcon, User as UserIcon } from "lucide-react";
import { AdminTodoTask } from "./admin-todo-card";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { updateAdminTodo, addAdminTodoComment, getSystemAdmins } from "@/actions/admin-todo-actions";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";


interface AdminTodoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: AdminTodoTask | null;
}

export function AdminTodoDialog({ open, onOpenChange, task }: AdminTodoDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [comment, setComment] = useState("");
    const [dueDate, setDueDate] = useState<string>("");
    const [assigneeId, setAssigneeId] = useState(""); // Simplified for now, just text or basic logic

    // System Admins
    const [systemAdmins, setSystemAdmins] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        getSystemAdmins().then(setSystemAdmins);
    }, []);

    // Optimistic comments
    const [localComments, setLocalComments] = useState<any[]>([]);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description || "");
            setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "");
            setAssigneeId(task.assignedTo?.id || "unassigned");
            setLocalComments(task.comments || []);
        }
    }, [task]);

    const handleSave = async (overrideAssigneeId?: string | any) => {
        if (!task) return;

        // Check if overrideAssigneeId is actually a string (and not an event object)
        let finalAssigneeId = typeof overrideAssigneeId === 'string' ? overrideAssigneeId : assigneeId;
        if (finalAssigneeId === "unassigned") finalAssigneeId = ""; // Clear it

        const res = await updateAdminTodo(task.id, {
            title,
            description,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            assignedToUserId: finalAssigneeId || undefined
        });

        if (res.success) {
            toast.success("Task updated");
        } else {
            toast.error("Failed to update");
        }
    };

    const handleSendComment = async () => {
        if (!task || !comment.trim()) return;

        const res = await addAdminTodoComment(task.id, comment);
        if (res.success && res.comment) {
            setLocalComments([...localComments, res.comment]);
            setComment("");
        } else {
            toast.error("Failed to add comment");
        }
    };

    if (!task) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[85vw] w-[85vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b bg-slate-50/50">
                    <DialogTitle className="sr-only">{title}</DialogTitle>
                    <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-white">{task.status}</Badge>
                        <span className="text-xs text-slate-400">Created by {task.createdBy?.name || 'Unknown'} on {new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-xl font-bold border-transparent hover:border-slate-200 focus:border-indigo-500 px-0 h-auto py-1"
                            onBlur={() => handleSave()}
                        />
                    </div>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                    {/* Left: Details */}
                    <div className="flex-[3] p-6 overflow-y-auto border-r border-slate-100 bg-white">
                        <div className="space-y-6">

                            {/* Meta Row */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Due Date</label>
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => { setDueDate(e.target.value); handleSave(); }}
                                        className="bg-slate-50 border-slate-200"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Assigned To</label>
                                    <Select
                                        value={assigneeId}
                                        onValueChange={(val) => { setAssigneeId(val); handleSave(val); }}
                                    >
                                        <SelectTrigger className="w-full bg-slate-50 border-slate-200 h-10">
                                            <SelectValue placeholder="Unassigned" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {systemAdmins.map((admin) => (
                                                <SelectItem key={admin.id} value={admin.id}>
                                                    {admin.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Description</label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="min-h-[150px] resize-y bg-slate-50/50 focus:bg-white"
                                    onBlur={() => handleSave()}
                                    placeholder="Add task details..."
                                />
                                <div className="flex justify-end mt-2">
                                    <Button size="sm" onClick={() => handleSave()} variant="secondary">Save Changes</Button>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Right: Comments */}
                    <div className="flex-[2] bg-slate-50 flex flex-col border-l border-slate-200 min-w-[280px]">
                        <div className="p-3 border-b bg-white/50 backdrop-blur-sm">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comments</h4>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4">
                                {localComments.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-4">No comments yet</p>
                                )}
                                {localComments.map((c) => (
                                    <div key={c.id} className="flex gap-2">
                                        <Avatar className="h-6 w-6 border bg-white">
                                            <AvatarFallback className="text-[10px] bg-indigo-50 text-indigo-700">
                                                {c.author.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-xs font-semibold text-slate-800">{c.author}</span>
                                                <span className="text-[9px] text-slate-400">
                                                    {new Date(c.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-xs text-slate-700 bg-white p-2 rounded border shadow-sm">
                                                {c.text}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <div className="p-3 bg-white border-t">
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Type..."
                                    className="min-h-[36px] max-h-[80px] resize-none bg-slate-50 focus:bg-white text-xs py-2"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                                />
                                <Button size="icon" className="h-[36px] w-[36px] shrink-0" disabled={!comment.trim()} onClick={handleSendComment}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
