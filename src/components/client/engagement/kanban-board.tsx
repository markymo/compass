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
    { id: '1', question: "What is the full legal name of the entity?", answer: "Robs TestCo Limited", status: 'DONE', assignee: { name: 'Alex', type: 'USER' } },
    { id: '2', question: "Provide the primary business address.", answer: "123 London Wall, EC2Y 5JA", status: 'SHARED', assignee: { name: 'Bank', type: 'BANK' } },
    { id: '3', question: "List all beneficial owners >25%.", status: 'INTERNAL_REVIEW', assignee: { name: 'Alex', type: 'USER' }, commentCount: 2, hasFlag: true },
    { id: '4', question: "Upload Certificate of Incorporation.", status: 'DRAFT', assignee: { name: 'Compass AI', type: 'AI' } },
    { id: '5', question: "Confirm tax residency jurisdiction.", status: 'QUERY', assignee: { name: 'Bob', type: 'USER' }, commentCount: 5 },
    { id: '6', question: "Is the entity listed on a regulated exchange?", answer: "No", status: 'DRAFT' },
    { id: '7', question: "Provide date of incorporation.", answer: "2023-01-01", status: 'SHARED' },
];

export function KanbanBoard({ engagementId }: { engagementId?: string }) {
    // hello-pangea/dnd requires strict mode handling in Next.js 13+ usually
    const [enabled, setEnabled] = useState(false);

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
        { id: 'SHARED', title: 'Shared with Bank', desc: 'Visible to J.P. Morgan' },
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

    const getTasksByStatus = (status: string) => tasks.filter(t =>
        status === 'INTERNAL_REVIEW'
            ? (t.status === 'INTERNAL_REVIEW' || t.status === 'QUERY')
            : t.status === status
    );

    if (!enabled) {
        return null; // Or a loading skeleton
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex h-full gap-6 overflow-x-auto pb-4">
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
            />
        </DragDropContext>
    );
}
