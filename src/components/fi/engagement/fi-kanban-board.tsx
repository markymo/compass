
"use client"

import { useState, useEffect } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanColumn } from "@/components/client/engagement/kanban-column"; // Reuse generic column
import { QuestionTask } from "@/components/client/engagement/question-card"; // Reuse generic card types
import { QuestionDetailDialog } from "@/components/client/engagement/question-detail-dialog"; // Reuse dialog
import { toast } from "sonner";
import { getBoardQuestions, updateQuestionStatus } from "@/actions/kanban-actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Filter, Loader2, Layout } from "lucide-react";
import { QuestionnaireExportButton } from "./questionnaire-export-button";

export function FIKanbanBoard({ engagementId, clientName = "Client" }: { engagementId: string; clientName?: string }) {
    const [enabled, setEnabled] = useState(false);

    // Strict Mode / Hydration fix for DnD
    useEffect(() => {
        const animation = requestAnimationFrame(() => setEnabled(true));
        return () => {
            cancelAnimationFrame(animation);
            setEnabled(false);
        };
    }, []);

    const [tasks, setTasks] = useState<QuestionTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>("all");

    // Load Data
    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await getBoardQuestions(engagementId);
                // @ts-ignore
                setTasks(data);
            } catch (e) {
                toast.error("Failed to load workbench");
            }
            setLoading(false);
        }
        load();
    }, [engagementId]);

    const [selectedTask, setSelectedTask] = useState<QuestionTask | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // FI Specific Columns
    const columns = [
        { id: 'SHARED', title: 'To Review', desc: 'Received from Client' }, // SHARED
        { id: 'SUPPLIER_REVIEW', title: 'In Evaluation', desc: 'Internal Assessment' }, // SUPPLIER_REVIEW
        { id: 'QUERY', title: 'Queries', desc: 'Awaiting Client Response' }, // QUERY
        { id: 'SUPPLIER_SIGNED_OFF', title: 'Approved', desc: 'Satisfied Requirements' }, // SUPPLIER_SIGNED_OFF
    ];

    const onDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;
        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        ) return;

        const movedTask = tasks.find(t => t.id === draggableId);
        if (!movedTask) return;

        // Optimistic Update
        const newStatus = destination.droppableId;
        const previousTasks = [...tasks];

        setTasks(prev => prev.map(t =>
            t.id === draggableId ? { ...t, status: newStatus as any } : t
        ));

        // Server Update
        const res = await updateQuestionStatus(draggableId, newStatus as any);
        if (!res.success) {
            toast.error("Failed to update status");
            setTasks(previousTasks);
        } else {
            // Optional: If moving to QUERY, maybe prompt for a comment?
            // For now, smooth D&D is fine.
        }
    };

    const handleTaskClick = (task: QuestionTask) => {
        setSelectedTask(task);
        setIsDialogOpen(true);
    };

    // Filter Logic:
    // 1. Questionnaire Filter
    // 2. Hide Client Drafts/Internal Reviews (Security/View Logic)
    //    - Only show items that are SHARED or later in the lifecycle, OR if they were previously shared (queries).
    //    - Actually, 'getBoardQuestions' returns current status.
    //    - If status is DRAFT or INTERNAL_REVIEW, FI should usually NOT see it.
    //    - UNLESS it was returned to DRAFT? No.
    //    - So we filter out invisible statuses.

    // Visible Statuses for FI:
    const VISIBLE_STATUSES = ['SHARED', 'SUPPLIER_REVIEW', 'QUERY', 'SUPPLIER_SIGNED_OFF', 'CLIENT_SIGNED_OFF', 'DONE'];

    const filteredTasks = tasks.filter(t => {
        // Status Visibility Check
        if (!VISIBLE_STATUSES.includes(t.status)) return false;

        // Questionnaire Filter
        // @ts-ignore
        if (selectedQuestionnaireId !== "all" && t.questionnaireId !== selectedQuestionnaireId) return false;

        return true;
    });

    // Group Statuses into Columns
    const getTasksByStatus = (columnId: string) => filteredTasks.filter(t => {
        if (columnId === 'SHARED') {
            // Also show CLIENT_SIGNED_OFF here?
            return t.status === 'SHARED' || t.status === 'CLIENT_SIGNED_OFF';
        }
        return t.status === columnId;
    });

    // Derive Unique Questionnaires for Filter
    // @ts-ignore
    const uniqueQuestionnaires = Array.from(new Set(tasks.map(t => t.questionnaireId))).filter(Boolean);


    if (!enabled) return <div className="p-12 text-center text-slate-400">Loading Workbench...</div>;

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-2 px-1">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-slate-200 shadow-sm">
                        <Filter className="h-4 w-4 text-slate-500 ml-2" />
                        <Select value={selectedQuestionnaireId} onValueChange={setSelectedQuestionnaireId}>
                            <SelectTrigger className="w-[200px] h-8 border-0 focus:ring-0">
                                <SelectValue placeholder="All Questionnaires" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Questionnaires</SelectItem>
                                {/* We need names, but tasks only have ID. 
                                    Ideally getBoardQuestions returns questionnaire metadata.
                                    For now, just ID is shown or we cant map it easily without extra data.
                                    Let's disable filter dropdown content if we don't have names, or use ID.
                                 */}
                                {/* Todo: Fix Mapping. For now, just 'all' */}
                            </SelectContent>
                        </Select>
                    </div>

                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                        {filteredTasks.length} Items
                        {loading && <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />}
                    </div>
                    <QuestionnaireExportButton
                        engagementId={engagementId}
                        questionnaireId={selectedQuestionnaireId}
                        className="h-8"
                    />
                </div>
            </div>

            {filteredTasks.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Layout className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Your workbench is empty</p>
                    <p className="text-slate-400 text-sm">Waiting for {clientName} to share items.</p>
                </div>
            ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex-1 overflow-x-auto">
                        <div className="flex h-full min-h-[500px] gap-6 pb-4">
                            {columns.map((col) => (
                                <KanbanColumn
                                    key={col.id}
                                    id={col.id}
                                    title={col.title}
                                    description={col.desc}
                                    tasks={getTasksByStatus(col.id)}
                                    onTaskClick={handleTaskClick}
                                />
                            ))}
                        </div>
                    </div>

                    <QuestionDetailDialog
                        open={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                        task={selectedTask}
                        // For FI View, we might want read-only or different permissions?
                        // reusing dialog for now.
                        clientLEId={undefined} // context?
                    />
                </DragDropContext>
            )}
        </div>
    );
}
