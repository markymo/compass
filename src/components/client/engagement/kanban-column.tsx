"use client"

import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { QuestionCard, QuestionTask } from "./question-card";

interface KanbanColumnProps {
    id: string; // This corresponds to the status
    title: string;
    description?: string;
    tasks: QuestionTask[];
    onTaskClick?: (task: QuestionTask) => void;
}

export function KanbanColumn({ id, title, description, tasks, onTaskClick }: KanbanColumnProps) {
    return (
        <div className="flex flex-col h-full w-[85vw] md:w-[300px] shrink-0 snap-center snap-always">
            {/* Header */}
            <div className="mb-3 px-1">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                        {tasks.length}
                    </span>
                </div>
                {description && (
                    <p className="text-xs text-slate-500 mt-1">{description}</p>
                )}
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "flex-1 bg-slate-50/50 rounded-xl p-2 border border-dashed border-slate-200 transition-colors",
                            snapshot.isDraggingOver && "bg-indigo-50/50 border-indigo-200",
                            "min-h-[150px]"
                        )}
                    >
                        <div className="space-y-3 min-h-[50px]">
                            {tasks.map((task, index) => (
                                <QuestionCard
                                    key={task.id}
                                    task={task}
                                    index={index}
                                    onClick={onTaskClick}
                                />
                            ))}
                            {provided.placeholder}
                        </div>
                    </div>
                )}
            </Droppable>
        </div>
    );
}
