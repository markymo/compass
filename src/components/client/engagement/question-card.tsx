"use client"

import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Check, X, Paperclip, Lock, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
export interface QuestionTask {
    id: string;
    questionnaireId: string;
    question: string;
    questionnaireName?: string;
    legalEntityName?: string;
    compactText?: string;
    answer?: string;
    status: 'DRAFT' | 'APPROVED' | 'SHARED' | 'RELEASED';
    assignedToUserId?: string;
    assignedEmail?: string;
    assignee?: {
        name: string;
        avatar?: string;
        type: 'AI' | 'USER' | 'BANK' | 'INVITEE';
    };
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
    customFieldDefinitionId?: string | null;
    commentCount?: number;
    activities?: any[];
    hasFlag?: boolean;
    isLocked?: boolean;
    allowAttachments?: boolean;
    documents?: any[];
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

    const statusColors = {
        'DRAFT': 'border-l-amber-400',
        'APPROVED': 'border-l-emerald-400',
        'SHARED': 'border-l-indigo-500',
        'RELEASED': 'border-l-slate-900 bg-slate-50'
    };



    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <Card
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                        "mb-0.5 rounded-sm border-l-4 relative group hover:shadow-md transition-all bg-white cursor-pointer p-0",
                        statusColors[task.status],
                        snapshot.isDragging && "shadow-2xl scale-105 z-50",
                        task.status === 'RELEASED' && "opacity-80"
                    )}
                >
                    <div className="px-2 pt-px pb-px">
                        {/* Line 1: Question text with AI button */}
                        <div className="flex items-center justify-between gap-2">
                            <p
                                className="text-sm font-semibold truncate text-slate-900 flex-1 leading-tight"
                                onClick={() => onClick?.(task)}
                            >
                                {task.compactText || task.question.slice(0, 20)}
                            </p>
                            <div className="flex items-center gap-1">
                                {(task.allowAttachments || (task.documents && task.documents.length > 0)) && (
                                    <Paperclip className={cn("h-3.5 w-3.5 flex-shrink-0", task.documents && task.documents.length > 0 ? "text-indigo-600" : "text-slate-400")} />
                                )}
                                {task.status === 'RELEASED' && (
                                    <Lock className="h-3.5 w-3.5 text-slate-900" />
                                )}
                                {task.status === 'SHARED' && (
                                    <Share2 className="h-3.5 w-3.5 text-indigo-600" />
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </Draggable>
    );
}
