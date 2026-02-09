"use client"

import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateAnswer, generateSingleQuestionAnswer } from "@/actions/kanban-actions";

export interface QuestionTask {
    id: string;
    questionnaireId: string;
    question: string;
    compactText?: string;
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

type AIState = 'idle' | 'generating' | 'success' | 'error';

export function QuestionCard({ task, index, onClick }: QuestionCardProps) {
    const [answer, setAnswer] = useState(task.answer || "");
    const [isSaving, setIsSaving] = useState(false);
    const [aiState, setAIState] = useState<AIState>('idle');

    const statusColors = {
        'DRAFT': 'border-l-slate-400',
        'INTERNAL_REVIEW': 'border-l-blue-500',
        'SHARED': 'border-l-indigo-600',
        'DONE': 'border-l-emerald-500',
        'QUERY': 'border-l-amber-500'
    };

    const handleSave = async () => {
        if (answer === task.answer) return;

        setIsSaving(true);
        try {
            await updateAnswer(task.id, answer);
        } catch (error) {
            console.error("Failed to save answer:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            handleSave();
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setAnswer(task.answer || "");
            e.currentTarget.blur();
        }
    };

    const handleAIGenerate = async (e: React.MouseEvent) => {
        e.stopPropagation();

        setAIState('generating');
        try {
            const result = await generateSingleQuestionAnswer(task.id);
            if (result.success && result.answer) {
                setAnswer(result.answer);
                setAIState('success');
                setTimeout(() => setAIState('idle'), 800);
            } else {
                setAIState('error');
                setTimeout(() => setAIState('idle'), 2000);
            }
        } catch (error) {
            console.error("AI generation failed:", error);
            setAIState('error');
            setTimeout(() => setAIState('idle'), 2000);
        }
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
                        task.status === 'DONE' && "bg-emerald-50/30"
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

                            {/* AI Generation Button */}
                            <button
                                onClick={handleAIGenerate}
                                disabled={aiState === 'generating' || task.isLocked}
                                className={cn(
                                    "w-5 h-5 flex-shrink-0 flex items-center justify-center rounded transition-all",
                                    "disabled:cursor-not-allowed",
                                    aiState === 'idle' && "opacity-40 hover:opacity-100 hover:scale-110 text-purple-600",
                                    aiState === 'generating' && "opacity-100 text-purple-600",
                                    aiState === 'success' && "opacity-100 text-emerald-600",
                                    aiState === 'error' && "opacity-100 text-red-600"
                                )}
                            >
                                {aiState === 'generating' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {aiState === 'success' && <Check className="h-3.5 w-3.5" />}
                                {aiState === 'error' && <X className="h-3.5 w-3.5" />}
                                {aiState === 'idle' && <Sparkles className="h-3.5 w-3.5" />}
                            </button>
                        </div>

                        {/* Line 2: Answer field */}
                        <input
                            type="text"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Click to answer..."
                            disabled={isSaving || task.isLocked}
                            className={cn(
                                "w-full text-xs bg-transparent border-none outline-none",
                                "focus:ring-1 focus:ring-purple-200 rounded px-1 py-0",
                                "placeholder:text-slate-300 text-slate-600 leading-tight",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        />
                    </div>
                </Card>
            )}
        </Draggable>
    );
}
