"use client"

import { Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AdminTodoStatus } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface AdminTodoTask {
    id: string;
    title: string;
    description?: string;
    status: AdminTodoStatus;
    dueDate?: Date;
    assignedTo?: {
        id: string;
        name: string;
        image?: string | null;
    };
    createdBy?: {
        id: string;
        name: string;
    };
    createdAt: Date;
    comments?: Array<{
        id: string;
        text: string;
        author: string;
        createdAt: Date;
        userId: string;
    }>;
}

interface AdminTodoCardProps {
    task: AdminTodoTask;
    index: number;
    onClick?: (task: AdminTodoTask) => void;
}

export function AdminTodoCard({ task, index, onClick }: AdminTodoCardProps) {
    const statusColor = {
        'BACKLOG': 'bg-slate-300',
        'DRAFTING': 'bg-blue-400',
        'IN_PROGRESS': 'bg-indigo-500',
        'DONE': 'bg-emerald-500',
    }[task.status] || 'bg-slate-200';

    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <Card
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onClick?.(task)}
                    className={cn(
                        "group hover:shadow-md transition-all mb-3 shadow-sm bg-white border-l-4 relative overflow-hidden",
                        snapshot.isDragging && "shadow-xl rotate-2 scale-105 z-50",
                        task.status === 'DONE' ? "border-l-emerald-500 bg-slate-50/50" : `border-l-${statusColor.replace('bg-', '')}`
                    )}
                    style={{
                        ...provided.draggableProps.style,
                        borderLeftColor: task.status === 'DONE' ? '#10b981' : undefined
                    }}
                >
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", statusColor)} />

                    <CardContent className="p-3 pl-4">
                        <div className="flex justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-3">
                                {task.title}
                            </p>
                        </div>

                        {/* Minimal Footer for Backlog items */}
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                                {task.assignedTo ? (
                                    <div className="flex items-center gap-1.5 p-0.5 pr-2 rounded-full bg-slate-50 border border-slate-100">
                                        <Avatar className="h-4 w-4">
                                            <AvatarImage src={task.assignedTo.image || undefined} />
                                            <AvatarFallback className="text-[8px] bg-indigo-100 text-indigo-700">
                                                {task.assignedTo.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[10px] font-medium text-slate-700">
                                            {task.assignedTo.name.split(' ')[0]}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-slate-300 italic pl-1">Unassigned</span>
                                )}
                            </div>

                            {(task.comments?.length || 0) > 0 && (
                                <div className="text-[10px] text-slate-400 flex items-center">
                                    <span className="mr-0.5">{task.comments?.length}</span> msg
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </Draggable>
    );
}
