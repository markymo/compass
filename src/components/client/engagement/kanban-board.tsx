"use client"

import { useState, useEffect } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanColumn } from "./kanban-column";
import { QuestionTask } from "./question-card";
import { QuestionDetailDialog } from "./question-detail-dialog";
import { toast } from "sonner";

import { getBoardQuestions, updateQuestionStatus } from "@/actions/kanban-actions";

// Mock Data Generator
const MOCK_TASKS: QuestionTask[] = [
    { id: '1', questionnaireId: 'mock', question: "What is the full legal name of the entity?", answer: "Robs TestCo Limited", status: 'DONE', assignee: { name: 'Alex', type: 'USER' } },
    { id: '2', questionnaireId: 'mock', question: "Provide the primary business address.", answer: "123 London Wall, EC2Y 5JA", status: 'SHARED', assignee: { name: 'Bank', type: 'BANK' } },
    { id: '3', questionnaireId: 'mock', question: "List all beneficial owners >25%.", status: 'INTERNAL_REVIEW', assignee: { name: 'Alex', type: 'USER' }, commentCount: 2, hasFlag: true },
    { id: '4', questionnaireId: 'mock', question: "Upload Certificate of Incorporation.", status: 'DRAFT', assignee: { name: 'Compass AI', type: 'AI' } },
    { id: '5', questionnaireId: 'mock', question: "Confirm tax residency jurisdiction.", status: 'QUERY', assignee: { name: 'Bob', type: 'USER' }, commentCount: 5 },
    { id: '6', questionnaireId: 'mock', question: "Is the entity listed on a regulated exchange?", answer: "No", status: 'DRAFT' },
    { id: '7', questionnaireId: 'mock', question: "Provide date of incorporation.", answer: "2023-01-01", status: 'SHARED' },
];

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { QuestionnaireExportButton } from "@/components/fi/engagement/questionnaire-export-button";

// ... existing imports

export function KanbanBoard({ engagementId, clientLEId, fiName = "Bank", questionnaires = [] }: { engagementId?: string; clientLEId?: string; fiName?: string; questionnaires?: any[] }) {
    // hello-pangea/dnd requires strict mode handling in Next.js 13+ usually
    const [enabled, setEnabled] = useState(false);
    const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>("all");

    useEffect(() => {
        const animation = requestAnimationFrame(() => setEnabled(true));
        return () => {
            cancelAnimationFrame(animation);
            setEnabled(false);
        };
    }, []);

    const [tasks, setTasks] = useState<QuestionTask[]>([]);
    const [loading, setLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        if (!engagementId) {
            // Fallback to mock if no ID provided (Dev mode)
            setTasks(MOCK_TASKS);
            return;
        }

        async function load() {
            setLoading(true);
            try {
                const data = await getBoardQuestions(engagementId!);
                // @ts-ignore - simplistic mapping for now
                setTasks(data);
            } catch (e) {
                toast.error("Failed to load board");
            }
            setLoading(false);
        }
        load();
    }, [engagementId]);

    const [selectedTask, setSelectedTask] = useState<QuestionTask | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Columns Definition
    const columns = [
        { id: 'DRAFT', title: 'Drafting', desc: 'AI suggestions & data entry' },
        { id: 'INTERNAL_REVIEW', title: 'Start Review', desc: 'Requires User approval' },
        { id: 'SHARED', title: 'Shared with Bank', desc: `Visible to ${fiName}` },
        { id: 'DONE', title: 'Agreed', desc: 'Signed off by both parties' },
    ];

    const onDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        // Dropped outside list
        if (!destination) return;

        // Dropped in same place
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

        if (source.droppableId !== destination.droppableId) {
            // Server Update
            // Don't toast on every move, distracts flow. Just error if fail.
            const result = await updateQuestionStatus(draggableId, newStatus as any);
            if (!result.success) {
                toast.error("Failed to save move");
                setTasks(previousTasks); // Rollback
            }
        }
    };

    const handleTaskClick = (task: QuestionTask) => {
        setSelectedTask(task);
        setIsDialogOpen(true);
    };

    // Filter Logic
    const filteredTasks = tasks.filter(t => {
        if (selectedQuestionnaireId === "all") return true;
        // @ts-ignore
        if (t.questionnaireId) return t.questionnaireId === selectedQuestionnaireId;
        return true; // If no questionnaireId on task, show it? Or hide? Let's show for safety or hide?
        // Based on update, q.questionnaireId IS mapped.
    });

    const getTasksByStatus = (status: string) => filteredTasks.filter(t =>
        status === 'INTERNAL_REVIEW'
            ? (t.status === 'INTERNAL_REVIEW' || t.status === 'QUERY')
            : t.status === status
    );

    if (!enabled) {
        return null; // Or a loading skeleton
    }

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <Select value={selectedQuestionnaireId} onValueChange={setSelectedQuestionnaireId}>
                        <SelectTrigger className="w-[280px] h-9">
                            <SelectValue placeholder="Filter by Questionnaire" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Questionnaires</SelectItem>
                            {questionnaires.map((q) => (
                                <SelectItem key={q.id} value={q.id}>
                                    {q.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-400 hidden sm:block">
                        Showing {filteredTasks.length} tasks
                    </div>
                    {engagementId && (
                        <QuestionnaireExportButton
                            engagementId={engagementId}
                            questionnaireId={selectedQuestionnaireId}
                            className="h-9"
                        />
                    )}
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex min-h-full gap-6 pb-4 overflow-x-auto">
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

                <QuestionDetailDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    task={selectedTask}
                    clientLEId={clientLEId}
                />
            </DragDropContext>
        </div >
    );
}
