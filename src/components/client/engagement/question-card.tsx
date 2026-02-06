"use client"

import { Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, AlertCircle, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuestionTask {
    id: string;
    questionnaireId: string;
    question: string;
    answer?: string;
    status: 'DRAFT' | 'INTERNAL_REVIEW' | 'SHARED' | 'DONE' | 'QUERY';
    assignedToUserId?: string;
    assignedEmail?: string;
    assignee?: {
        name: string;
        avatar?: string;
        type: 'AI' | 'USER' | 'BANK' | 'INVITEE';
    };
    commentCount?: number;
    activities?: any[];
    hasFlag?: boolean;
    isLocked?: boolean;
    comments?: Array<{
        id: string;
        text: string;
        author: string;
        type: string;
        time: string;
    }>;
}

interface QuestionCardProps {
    task: QuestionTask;
    index: number;
    onClick?: (task: QuestionTask) => void;
}

export function QuestionCard({ task, index, onClick }: QuestionCardProps) {
    const statusColor = {
        'DRAFT': 'bg-slate-300',
        'INTERNAL_REVIEW': 'bg-blue-400',
        'SHARED': 'bg-indigo-500',
        'DONE': 'bg-emerald-500',
        'QUERY': 'bg-amber-500'
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
                        borderLeftColor: task.status === 'DONE' ? '#10b981' : undefined // Tailwind arb color fallback
                    }}
                >
                    {/* Status Strip override for Tailwind dynamic class limitations if needed, usually cleaner to use style or strictly mapped classes. 
                        Let's rely on standard classes for simplicity first, but border-l-4 needs distinctive color 
                    */}
                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", statusColor)} />

                    <CardContent className="p-3 pl-4">
                        {/* Top Row: Question & Flag */}
                        <div className="flex justify-between gap-2 mb-2">
                            <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-3">
                                {task.question}
                            </p>
                            {task.hasFlag && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        </div>

                        {/* Answer Snippet (if exists) */}
                        {task.answer ? (
                            <div className="mb-3 text-xs text-slate-600 bg-slate-100/50 p-2 rounded border border-slate-100 font-mono truncate">
                                <span className="text-slate-400 mr-1">A:</span>
                                {task.answer}
                            </div>
                        ) : (
                            <div className="mb-3 h-6" /> // Spacer or "Needs Input" indicator? Kept clean for now.
                        )}

                        {/* Footer: Meta */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {task.assignee ? (
                                    <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200" title={task.assignee.name}>
                                        {task.assignee.type === 'AI' ? (
                                            <Bot className="h-3 w-3 text-indigo-600" />
                                        ) : (
                                            <span className="text-[9px] font-bold text-indigo-700">{task.assignee.name.charAt(0)}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-5 w-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center">
                                        <User className="h-3 w-3 text-slate-300" />
                                    </div>
                                )}
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {task.id.slice(0, 4)}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                {task.commentCount ? (
                                    <div className="flex items-center text-slate-400 text-xs">
                                        <MessageSquare className="h-3 w-3 mr-1" />
                                        {task.commentCount}
                                    </div>
                                ) : null}
                                {task.status === 'DONE' && (
                                    <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </Draggable>
    );
}
