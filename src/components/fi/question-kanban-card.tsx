
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, AlertCircle, FileText } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";
import Link from 'next/link';

interface QuestionKanbanCardProps {
    question: any; // Using any for speed, ideally proper type
}

export function QuestionKanbanCard({ question }: QuestionKanbanCardProps) {
    const clientName = question.questionnaire?.fiEngagement?.clientLE?.name || "Unknown Client";
    const questionnaireName = question.questionnaire?.name || "Unknown Questionnaire";

    // Status color mapping
    const statusColors: Record<string, string> = {
        'DRAFT': 'bg-slate-100 text-slate-700',
        'INTERNAL_REVIEW': 'bg-blue-50 text-blue-700 border-blue-200',
        'SHARED': 'bg-amber-50 text-amber-700 border-amber-200',
        'QUERY': 'bg-red-50 text-red-700 border-red-200',
        'DONE': 'bg-green-50 text-green-700 border-green-200',
    };

    const engageId = question.questionnaire?.fiEngagement?.id;
    const questId = question.questionnaire?.id;

    // Construct URL: /app/fi/engagements/[engagementId]/workbench/[questionnaireId]?question=[questionId]
    const workbenchUrl = engageId && questId
        ? `/app/fi/engagements/${engageId}/workbench/${questId}?question=${question.id}`
        : "#";

    return (
        <Link href={workbenchUrl} className="block group">
            <Card className="mb-3 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-slate-200 hover:border-l-indigo-500">
                <CardContent className="p-4 space-y-3">
                    {/* Header: Client & Questionnaire */}
                    <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="bg-slate-50 font-normal text-xs px-2 py-0.5 truncate max-w-[120px]">
                            {clientName}
                        </Badge>
                        <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {formatDistanceToNow(new Date(question.updatedAt), { addSuffix: true })}
                        </span>
                    </div>

                    {/* Question Text & Answer */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-900 leading-tight">
                            {question.text}
                        </p>

                        {question.answer && (
                            <div className="bg-emerald-50/50 p-2 rounded text-xs text-slate-700 border border-emerald-100 italic">
                                "{question.answer}"
                            </div>
                        )}

                        <p className="text-[10px] text-slate-400 truncate pt-1">
                            {questionnaireName}
                        </p>
                    </div>

                    {/* Footer: Answer Preview & Status */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <div className="flex gap-2 text-slate-400">
                            {/* Indicators if it has answer or comments */}
                            {question.answer && (
                                <MessageSquare className="h-4 w-4 text-emerald-500" />
                            )}
                            {question.comments && question.comments.length > 0 && (
                                <div className="flex items-center text-xs">
                                    <span className="bg-slate-100 px-1 rounded">{question.comments.length}</span>
                                </div>
                            )}
                        </div>

                        <Badge
                            variant="secondary"
                            className={cn("text-[10px] uppercase font-bold tracking-wider", statusColors[question.status] || 'bg-slate-100')}
                        >
                            {question.status.replace('_', ' ')}
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
