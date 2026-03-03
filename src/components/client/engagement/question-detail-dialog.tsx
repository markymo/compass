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
import { Bot, User, Send, History, MessageSquare, Sparkles, Lock, Unlock, Loader2, Database, UserPlus, Paperclip, FileText, Download, Trash2, Check, Share2, CheckCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { QuestionTask } from "./question-card";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { upload } from "@vercel/blob/client";

interface QuestionDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: QuestionTask | null;
    clientLEId?: string;
}

import { updateAnswer, updateSupplierNote, generateSingleQuestionAnswer, toggleQuestionLock, getLETeamMembers, assignQuestion, attachDocumentToQuestion, approveQuestionMapping, shareQuestion, releaseQuestion } from "@/actions/kanban-actions";
import { getFieldDetail, FieldDetailData } from "@/actions/kyc-query";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ... existing imports

export function QuestionDetailDialog({ open, onOpenChange, task, clientLEId }: QuestionDetailDialogProps) {
    const router = useRouter();
    const [supplierNote, setSupplierNote] = useState("");
    const [supplierNoteMeta, setSupplierNoteMeta] = useState<{ updatedAt?: string, updatedBy?: string }>({});
    const [answer, setAnswer] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [fieldData, setFieldData] = useState<FieldDetailData | null>(null);
    const [isLoadingField, setIsLoadingField] = useState(false);

    // Optimistic Activities
    const [localActivities, setLocalActivities] = useState<any[]>([]);

    // Sync local state when task opens
    useEffect(() => {
        if (task) {
            setAnswer(task.answer || "");
            setIsLocked(task.isLocked || task.status === 'RELEASED');
            setLocalActivities(task.activities || []);
        }
    }, [task]);

    // Sync initial supplier notes
    useEffect(() => {
        if (task) {
            setSupplierNote((task as any).supplierNote || "");
            setSupplierNoteMeta({
                updatedAt: (task as any).supplierNoteUpdatedAt,
                updatedBy: (task as any).supplierNoteUpdatedBy
            });
        } else {
            setSupplierNote("");
            setSupplierNoteMeta({});
        }
    }, [task]);

    // Optimistic documents (initially from task, then appended after upload)
    const [localDocuments, setLocalDocuments] = useState<any[]>([]);

    useEffect(() => {
        setLocalDocuments(task?.documents || []);
    }, [task]);

    // Fetch Team for Assignment
    useEffect(() => {
        if (open && clientLEId) {
            fetchTeam();
        }
    }, [open, clientLEId]);

    const fetchTeam = async () => {
        if (!clientLEId) return;
        const res = await getLETeamMembers(clientLEId);
        if (res.success && res.team) {
            setTeamMembers(res.team);
        }
    };

    // Fetch Mapping/Field Data
    useEffect(() => {
        if (open && task && clientLEId && (task.masterFieldNo || task.customFieldDefinitionId || task.masterQuestionGroupId)) {
            loadFieldData();
        } else {
            setFieldData(null);
        }
    }, [open, task, clientLEId]);

    const loadFieldData = async () => {
        setIsLoadingField(true);
        try {
            const data = await getFieldDetail(clientLEId!, task!.masterFieldNo || 0, 'CLIENT_LE', task!.customFieldDefinitionId || undefined, task!.masterQuestionGroupId || undefined);
            setFieldData(data);
        } catch (error) {
            console.error("Failed to fetch map data", error);
        } finally {
            setIsLoadingField(false);
        }
    };

    const handleSaveAnswer = async () => {
        if (!task) return;
        setIsSaving(true);
        const res = await updateAnswer(task.id, answer);
        if (res.success) {
            toast.success("Answer saved");
            if (res.activity) {
                setLocalActivities([res.activity, ...localActivities]);
            }
        } else {
            toast.error("Failed to save answer");
        }
        setIsSaving(false);
    };

    const handleGenerate = async () => {
        if (!task || isLocked) return;
        setIsGenerating(true);
        const res = await generateSingleQuestionAnswer(task.id);
        if (res.success && res.answer) {
            setAnswer(res.answer);
            toast.success("Answer generated");
            if (res.activity) {
                setLocalActivities([res.activity, ...localActivities]);
            }
        } else {
            toast.error("Generation failed");
        }
        setIsGenerating(false);
    };

    const handleToggleLock = async () => {
        if (!task || task.status === 'RELEASED') return;
        const newLockState = !isLocked;
        setIsLocked(newLockState); // Optimistic

        const res = await toggleQuestionLock(task.id, newLockState);
        if (res.success) {
            toast.success(newLockState ? "Answer Locked" : "Answer Unlocked");
            if (res.activity) {
                setLocalActivities([res.activity, ...localActivities]);
            }
        } else {
            setIsLocked(!newLockState); // Revert
            toast.error("Failed to toggle lock");
        }
    };

    const handleApproveMapping = async () => {
        if (!task) return;
        const res = await approveQuestionMapping(task.id);
        if (res.success) {
            toast.success("Mapping Approved");
            router.refresh();
        } else {
            toast.error(res.error || "Approval failed");
        }
    };

    const handleShare = async (isShared: boolean) => {
        if (!task) return;
        const res = await shareQuestion(task.id, isShared);
        if (res.success) {
            toast.success(isShared ? "Question Shared" : "Question Unshared");
            router.refresh();
        } else {
            toast.error(res.error || "Sharing failed");
        }
    };

    const handleRelease = async () => {
        if (!task) return;
        const res = await releaseQuestion(task.id);
        if (res.success) {
            toast.success("Question Released & Locked");
            router.refresh();
        } else {
            toast.error(res.error || "Release failed");
        }
    };

    const handleSaveSupplierNote = async () => {
        if (!task || !supplierNote.trim()) return;

        const res = await updateSupplierNote(task.id, supplierNote);
        if (res.success && res.activity) {
            setSupplierNoteMeta({
                updatedAt: res.supplierNoteUpdatedAt,
                updatedBy: res.supplierNoteUpdatedBy
            });
            setLocalActivities([res.activity, ...localActivities]);
            toast.success("Note saved successfully");
        } else {
            toast.error("Failed to save note");
        }
    };

    const handleAssign = async (assigneeVal: string) => {
        if (!task) return;
        setIsAssigning(true);

        let assignee: { userId?: string, email?: string } | null = null;
        if (assigneeVal.startsWith("u:")) {
            assignee = { userId: assigneeVal.substring(2) };
        } else if (assigneeVal.startsWith("i:")) {
            assignee = { email: assigneeVal.substring(2) };
        }

        const res = await assignQuestion(task.id, assignee);
        if (res.success) {
            toast.success("Assignee updated");
            if (res.activity) {
                setLocalActivities([res.activity, ...localActivities]);
            }
        } else {
            toast.error("Failed to update assignee");
        }
        setIsAssigning(false);
    };

    if (!task) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[90vw] w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                                "bg-white",
                                task.status === 'RELEASED' && "border-slate-900 text-slate-900 border-2",
                                task.status === 'SHARED' && "border-indigo-600 text-indigo-600",
                                task.status === 'APPROVED' && "border-emerald-600 text-emerald-600"
                            )}>{task.status.replace('_', ' ')}</Badge>
                            {task.hasFlag && <Badge variant="destructive">Flagged</Badge>}

                            {task.status !== 'RELEASED' && (
                                <Button size="sm" variant="ghost"
                                    onClick={handleToggleLock}
                                    className={cn("h-6 px-2 text-xs gap-1", isLocked ? "text-amber-600 hover:text-amber-700 bg-amber-50" : "text-slate-400 hover:text-slate-600")}
                                >
                                    {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                    {isLocked ? "Locked" : "Unlocked"}
                                </Button>
                            )}
                            {task.status === 'RELEASED' && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                                    <Lock className="h-3 w-3" />
                                    Read Only Snapshot
                                </div>
                            )}
                        </div>
                        <div className={cn(
                            "flex items-center text-xs px-2 py-1 rounded-full font-medium border mr-8 transition-colors",
                            task.answer ? "text-indigo-600 bg-indigo-50 border-indigo-100" : "text-slate-500 bg-slate-50 border-slate-200"
                        )} title="Updates will be saved to Legal Entity Knowledge Base">
                            <Database className={cn("h-3 w-3 mr-1.5", task.answer ? "text-indigo-600" : "text-slate-400")} />
                            {task.answer ? "Synced to Knowledge Base" : "Syncs upon Save"}
                        </div>
                    </div>
                    <DialogTitle className="text-xl leading-snug font-playfair">{task.question}</DialogTitle>
                    <div className="flex items-center gap-4 mt-2">
                        <DialogDescription className="text-xs">
                            Internal ID: {task.id.slice(0, 8)}
                        </DialogDescription>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Assignee:</span>
                            <Select
                                onValueChange={handleAssign}
                                disabled={isAssigning}
                                defaultValue={task.assignedToUserId ? `u:${task.assignedToUserId}` : (task.assignedEmail ? `i:${task.assignedEmail}` : "unassigned")}
                            >
                                <SelectTrigger className="h-7 text-xs bg-white border-slate-200 min-w-[140px]">
                                    <SelectValue placeholder="Assign user..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {teamMembers.map((member) => (
                                        <SelectItem
                                            key={member.id || member.email}
                                            value={member.id ? `u:${member.id}` : `i:${member.email}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={cn("h-1.5 w-1.5 rounded-full", member.status === 'ACTIVE' ? "bg-green-500" : "bg-amber-400")} />
                                                <span>{member.name}</span>
                                                {member.status === 'PENDING' && <span className="text-[10px] opacity-50 ml-1">(Invited)</span>}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Answer & Details (Wait 60% approx) */}
                    <div className="flex-[3] p-8 overflow-y-auto border-r border-slate-100 bg-white">
                        <div className="space-y-8">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-slate-900">Proposed Answer</h4>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-8 w-8 disabled:opacity-50"
                                        title="Auto-Generate with AI"
                                        onClick={handleGenerate}
                                        disabled={isGenerating || isLocked}
                                    >
                                        {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                    </Button>
                                </div>
                                <div className="relative">
                                    <Textarea
                                        className={cn(
                                            "min-h-[200px] text-base leading-relaxed p-4 border-slate-200 focus:bg-white transition-colors resize-y font-normal",
                                            (isLocked || task.status === 'RELEASED') ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-50"
                                        )}
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        placeholder="Draft the official answer here..."
                                        readOnly={isLocked || task.status === 'RELEASED'}
                                    />
                                    <div className="absolute bottom-4 right-4 flex gap-2">
                                        {(!isLocked && task.status !== 'RELEASED') && (
                                            <Button size="sm" onClick={handleSaveAnswer} disabled={isSaving}>
                                                {isSaving ? "Saving..." : "Save Draft"}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-3 p-5 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    {/* Mapping Header indicating it inherits values */}
                                    <div className={cn("absolute top-0 left-0 w-1 h-full", (task.masterFieldNo || task.customFieldDefinitionId || task.masterQuestionGroupId) ? "bg-emerald-500" : "bg-amber-500")}></div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            {task.masterFieldNo || task.customFieldDefinitionId || task.masterQuestionGroupId ? (
                                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-1 px-1.5 py-0">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Mapped
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 gap-1 px-1.5 py-0">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Not Mapped
                                                </Badge>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                                                    {fieldData?.fieldName || (task.masterFieldNo ? `Field #${task.masterFieldNo}` : (task.customFieldDefinitionId ? `Custom Field ${task.customFieldDefinitionId}` : (task.masterQuestionGroupId ? `Group Mapping` : "Unmapped Text")))}
                                                </p>
                                                <span className="text-[10px] text-slate-400">
                                                    {fieldData?.category || (task.masterFieldNo || task.customFieldDefinitionId || task.masterQuestionGroupId ? "Authoritative Master Data" : "Needs Map Configuration")}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {task.status === 'DRAFT' && (task.masterFieldNo || task.customFieldDefinitionId || task.masterQuestionGroupId) && (
                                                <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 w-full shadow-sm" onClick={handleApproveMapping}>
                                                    <Check className="h-3 w-3 mr-1" /> Approve
                                                </Button>
                                            )}
                                            {task.status === 'APPROVED' && (
                                                <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 flex-1 shadow-sm" onClick={() => handleShare(true)}>
                                                    <Share2 className="h-3 w-3 mr-1" /> Share
                                                </Button>
                                            )}
                                            {task.status === 'SHARED' && (
                                                <Button size="sm" variant="outline" className="h-7 text-xs text-slate-600 flex-1 shadow-sm border-slate-200" onClick={() => handleShare(false)}>
                                                    Unshare
                                                </Button>
                                            )}
                                            {(task.status === 'APPROVED' || task.status === 'SHARED') && (
                                                <Button size="sm" variant="secondary" className="h-7 text-xs bg-slate-900 text-white hover:bg-slate-800 flex-1 shadow-sm" onClick={handleRelease}>
                                                    <Lock className="h-3 w-3 mr-1" /> Release
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {(task.masterFieldNo || task.customFieldDefinitionId || task.masterQuestionGroupId) && (
                                        <div className="bg-slate-50/50 p-3 rounded border border-slate-100 mt-1">
                                            {isLoadingField ? (
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Loading Authoritative Value...
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                        Authoritative Value
                                                    </div>
                                                    {fieldData?.current?.value != null ? (
                                                        <div className="text-sm font-medium text-slate-900">
                                                            {Array.isArray(fieldData.current.value) ? (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {fieldData.current.value.map((v: any, idx: number) => (
                                                                        <Badge key={idx} variant="outline" className="bg-white border-slate-300 text-slate-800 py-0.5 px-2 text-xs">
                                                                            {String(v)}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            ) : typeof fieldData.current.value === "object" ? (
                                                                <div className="flex flex-col gap-1 mt-1">
                                                                    {Object.entries(fieldData.current.value).map(([key, val]) => (
                                                                        <div key={key} className="text-xs bg-slate-100 text-slate-800 py-1 px-2 rounded-md">
                                                                            <span className="font-semibold text-slate-500 mr-2">{key}:</span>
                                                                            {String(val)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                String(fieldData.current.value)
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs italic text-slate-400">No value recorded</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* Documents Section */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="h-4 w-4 text-indigo-600" />
                                    <h4 className="text-sm font-semibold text-slate-900">Supporting Documents</h4>
                                </div>
                                <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 space-y-4">

                                    {/* File List */}
                                    {localDocuments.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                            {localDocuments.map((doc: any) => (
                                                <div key={doc.id} className="bg-white border text-sm rounded-lg p-3 flex items-start gap-3 shadow-sm group">
                                                    <div className="h-8 w-8 rounded bg-indigo-50 flex items-center justify-center shrink-0">
                                                        <FileText className="h-4 w-4 text-indigo-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-900 truncate">{doc.name}</p>
                                                        <p className="text-xs text-slate-500">{doc.kbSize ? `${doc.kbSize} KB • ` : ''} {doc.fileType}</p>
                                                    </div>
                                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" asChild>
                                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                <Download className="h-3 w-3" />
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Uploader */}
                                    {!isLocked && (
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="file"
                                                id={`file-upload-${task.id}`}
                                                className="hidden"
                                                disabled={isUploadingFile}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file || !clientLEId) return;

                                                    setIsUploadingFile(true);
                                                    try {
                                                        // Step 1: Upload file to Vercel Blob storage
                                                        // We pass an empty clientPayload here since we'll call
                                                        // attachDocumentToQuestion directly (more reliable than onUploadCompleted)
                                                        const newBlob = await upload(file.name, file, {
                                                            access: 'public',
                                                            handleUploadUrl: '/api/upload',
                                                        });

                                                        // Step 2: Directly call the server action to link the doc to the DB.
                                                        // This is more reliable than the Vercel Blob onUploadCompleted callback
                                                        // which does not fire reliably in local development.
                                                        const res = await attachDocumentToQuestion(
                                                            task.id,
                                                            newBlob.url,
                                                            file.name,
                                                            file.size
                                                        );

                                                        if (!res.success) {
                                                            console.error("DB link failed:", res.error);
                                                            toast.error(`Upload failed: ${res.error}`);
                                                            return;
                                                        }

                                                        // Optimistically update local docs list
                                                        setLocalDocuments(prev => [
                                                            ...prev,
                                                            {
                                                                id: (res as any).document?.id || newBlob.url,
                                                                name: file.name,
                                                                fileUrl: newBlob.url,
                                                                fileType: file.name.split('.').pop() || 'file',
                                                                kbSize: Math.round(file.size / 1024),
                                                            }
                                                        ]);
                                                        toast.success("Document attached");
                                                        router.refresh(); // Sync server-side Documents tab
                                                    } catch (error) {
                                                        console.error("Upload error", error);
                                                        toast.error("Failed to upload document");
                                                    } finally {
                                                        setIsUploadingFile(false);
                                                        // Reset input
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="outline"
                                                className="w-full border-dashed"
                                                disabled={isUploadingFile}
                                                onClick={() => document.getElementById(`file-upload-${task.id}`)?.click()}
                                            >
                                                {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Paperclip className="h-4 w-4 mr-2" />}
                                                {isUploadingFile ? "Uploading..." : "Attach Document"}
                                            </Button>
                                        </div>
                                    )}
                                    {isLocked && localDocuments.length === 0 && (
                                        <div className="text-center py-6">
                                            <p className="text-sm text-slate-500">No documents attached.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Activity History</h4>
                                <div className="text-sm text-slate-600 space-y-3">
                                    {(localActivities || []).length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
                                    )}
                                    {(localActivities || []).map((activity: any) => (
                                        <div key={activity.id} className="flex items-start gap-3">
                                            <div className="mt-0.5 h-6 w-6 bg-white border rounded shadow-sm flex items-center justify-center shrink-0 text-slate-400">
                                                {activity.type === 'AI_GENERATED' && <Sparkles className="h-3 w-3 text-indigo-500" />}
                                                {activity.type === 'ANSWER_UPDATED' && <History className="h-3 w-3" />}
                                                {activity.type === 'LOCKED' || activity.type === 'UNLOCKED' && <Lock className="h-3 w-3 text-amber-500" />}
                                                {activity.type === 'MAPPING_APPROVED' && <Check className="h-3 w-3 text-emerald-500" />}
                                                {activity.type === 'QUESTION_RELEASED' && <Lock className="h-3 w-3 text-slate-900" />}
                                                {activity.type === 'QUESTION_SHARED' && <Share2 className="h-3 w-3 text-indigo-500" />}
                                                {activity.type === 'ASSIGNED' && <UserPlus className="h-3 w-3 text-blue-500" />}
                                                {activity.type === 'SUPPLIER_NOTE_UPDATED' && <MessageSquare className="h-3 w-3 text-sky-500" />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-900">
                                                    {activity.userName}
                                                    <span className="font-normal text-slate-500">
                                                        {activity.type === 'AI_GENERATED' && " generated an answer via AI"}
                                                        {activity.type === 'ANSWER_UPDATED' && " updated the answer"}
                                                        {activity.type === 'LOCKED' && " locked the question"}
                                                        {activity.type === 'UNLOCKED' && " unlocked the question"}
                                                        {activity.type === 'MAPPING_APPROVED' && " approved the master data mapping"}
                                                        {activity.type === 'QUESTION_RELEASED' && " released and snapshotted the final answer"}
                                                        {activity.type === 'QUESTION_SHARED' && " shared the answer with the financial institution"}
                                                        {activity.type === 'QUESTION_UNSHARED' && " retracted the shared status"}
                                                        {activity.type === 'ASSIGNED' && ` assigned the question to ${activity.details?.assignedEmail || (activity.details?.assignedToUserId ? 'Team Member' : 'nobody')}`}
                                                        {activity.type === 'SUPPLIER_NOTE_UPDATED' && " updated the Note for Supplier"}
                                                    </span>
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {new Date(activity.createdAt).toLocaleString()}
                                                </p>
                                                {activity.type === 'AI_GENERATED' && activity.details && (
                                                    <div className="mt-2 space-y-1.5">
                                                        {/* Answer Snippet */}
                                                        {activity.details.answerSnippet && (
                                                            <p className="text-xs text-slate-600 italic border-l-2 border-indigo-200 pl-2 line-clamp-2">
                                                                "{activity.details.answerSnippet}"
                                                            </p>
                                                        )}

                                                        {/* Metadata Grid */}
                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                            {activity.details.confidence && (
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${activity.details.confidence > 0.8 ? 'bg-green-100 text-green-700' :
                                                                    activity.details.confidence > 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                                    }`}>
                                                                    {Math.round(activity.details.confidence * 100)}% Confidence
                                                                </span>
                                                            )}
                                                            {activity.details.sourceQuote && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600" title={activity.details.sourceQuote}>
                                                                    Source: Knowledge Base
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Note for Supplier */}
                    <div className="flex-[2] bg-slate-50 flex flex-col border-l border-slate-200">
                        <div className="p-4 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Note for Supplier
                            </h4>
                        </div>
                        <div className="flex-1 p-6 flex flex-col gap-4">
                            <Textarea
                                className={cn(
                                    "flex-1 text-sm leading-relaxed p-4 border border-slate-200 focus:bg-white transition-colors resize-none",
                                    (isLocked || task.status === 'RELEASED') ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"
                                )}
                                value={supplierNote}
                                onChange={(e) => setSupplierNote(e.target.value)}
                                placeholder="Add an explanatory note for the supplier that goes beyond the pure answer provided by the mapped field..."
                                readOnly={isLocked || task.status === 'RELEASED'}
                            />
                        </div>
                        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                            <div className="text-[10px] text-slate-500 space-y-0.5">
                                {(supplierNoteMeta.updatedAt || supplierNoteMeta.updatedBy) ? (
                                    <>
                                        <p>Last edited by <span className="font-semibold text-slate-700">{supplierNoteMeta.updatedBy || "System"}</span></p>
                                        <p>{supplierNoteMeta.updatedAt}</p>
                                    </>
                                ) : (
                                    <p className="italic text-slate-400">No notes saved yet.</p>
                                )}
                            </div>
                            {(!isLocked && task.status !== 'RELEASED') && (
                                <Button size="sm" onClick={handleSaveSupplierNote} disabled={isSaving}>
                                    {isSaving ? "Saving..." : "Save Note"}
                                </Button>
                            )}
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
