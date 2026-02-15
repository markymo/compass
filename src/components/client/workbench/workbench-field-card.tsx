import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkbenchField } from "@/actions/kyc-query";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { Check, Edit2, ShieldAlert, Sparkles, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { applyFieldCandidate, applyManualOverride } from "@/actions/kyc-manual-update";
import { applyMasterToQuestion } from "@/actions/kyc-propagation";

interface WorkbenchFieldCardProps {
    field: WorkbenchField;
    leId: string;
    onUpdate?: () => void;
}

export function WorkbenchFieldCard({ field, leId, onUpdate }: WorkbenchFieldCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState<string>(
        field.currentValue ? String(field.currentValue) : ""
    );
    const [isSaving, setIsSaving] = useState(false);

    // Helper to determine status color
    const getSourceColor = (source?: string) => {
        if (!source) return "bg-gray-100 text-gray-800";
        if (source === 'GLEIF') return "bg-orange-100 text-orange-800 border-orange-200";
        if (source === 'USER_INPUT') return "bg-blue-100 text-blue-800 border-blue-200";
        return "bg-slate-100 text-slate-800";
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Determine if strict override or just update
            // For now, simple manual override
            const success = await applyManualOverride(leId, field.key, editValue, "Manual update via Workbench");
            if (success) {
                toast.success("Field updated successfully");
                setIsEditing(false);
                onUpdate?.();
            } else {
                toast.error("Failed to update field");
            }
        } catch (error) {
            toast.error("Error updating field");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const renderCurrentValue = () => {
        if (field.type === 'GROUP') {
            // Render Group Values
            const values = field.currentValue as Record<number, any>;
            if (!values) return <span className="text-slate-400 italic">No Data</span>;
            const isEmpty = Object.keys(values).length === 0;

            if (isEmpty) return <span className="text-slate-400 italic">No Data</span>;

            return (
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {field.groupFieldNos?.map(fNo => (
                        <div key={fNo} className="flex flex-col">
                            <span className="text-xs text-slate-500">Field {fNo}</span>
                            <span className="font-medium">{values[fNo] || '-'}</span>
                        </div>
                    ))}
                </div>
            );
        }

        // Single Field
        if (field.currentValue === null || field.currentValue === undefined) {
            return <span className="text-slate-400 italic">No Data</span>;
        }

        return <span className="text-lg font-medium text-slate-900">{String(field.currentValue)}</span>;
    };

    return (
        <Card className="mb-4 shadow-sm border-slate-200">
            <CardHeader className="pb-3 pt-4 px-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-semibold text-slate-800">
                                {field.label}
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px] text-slate-400 font-mono">
                                #{field.key}
                            </Badge>
                        </div>
                        {field.definition?.notes && (
                            <p className="text-xs text-slate-500 line-clamp-1">{field.definition.notes}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {field.currentSource && (
                            <Badge variant="secondary" className={`text-xs border ${getSourceColor(field.currentSource)}`}>
                                {field.currentSource}
                            </Badge>
                        )}
                        {field.lastUpdated && (
                            <span className="text-[10px] text-slate-400">
                                {format(new Date(field.lastUpdated), 'MMM d, yyyy')}
                            </span>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4 px-4">
                {/* 1. Golden Record Section */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 mr-4">
                        {isEditing && field.type === 'SINGLE' ? (
                            <div className="flex gap-2">
                                <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-9"
                                />
                                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? "Saving..." : <Check className="w-4 h-4" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                                    X
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {renderCurrentValue()}
                                {field.type === 'SINGLE' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-slate-700"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Linked Questions Accordion */}
                <Accordion type="single" collapsible className="w-full border-t border-slate-100">
                    <AccordionItem value="questions" className="border-b-0">
                        <AccordionTrigger className="py-2 text-xs text-slate-500 hover:text-slate-800 hover:no-underline">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-indigo-600">{field.linkedQuestions.length}</span> Linked Question{field.linkedQuestions.length !== 1 ? 's' : ''}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-2 pl-4 border-l-2 border-indigo-50 mt-1">
                                {field.linkedQuestions.map(q => {
                                    // Determine Sync Status
                                    let syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT' = 'SYNCED';
                                    let masterValueString = '';

                                    if (field.type === 'GROUP') {
                                        masterValueString = JSON.stringify(field.currentValue);
                                    } else {
                                        masterValueString = String(field.currentValue || '');
                                    }

                                    if (!q.answer) {
                                        syncStatus = 'PENDING';
                                    } else if (q.answer !== masterValueString) {
                                        syncStatus = 'CONFLICT';
                                    }

                                    return (
                                        <div key={q.id} className="text-sm border-b border-slate-50 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium text-slate-700 line-clamp-2 pr-2" title={q.text}>{q.text}</p>
                                                <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                                    <Badge variant="outline" className="text-[10px] h-5">
                                                        {q.questionnaireName}
                                                    </Badge>
                                                    {q.engagementOrgName && (
                                                        <Badge variant="secondary" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-100">
                                                            {q.engagementOrgName}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs text-slate-400 block mb-0.5">Current Answer:</span>
                                                    {q.status === 'ANSWERED' ? (
                                                        <span className={`text-xs font-mono truncate block ${syncStatus === 'CONFLICT' ? 'text-amber-600' : 'text-indigo-700'}`} title={q.answer || ''}>
                                                            {q.answer}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Empty</span>
                                                    )}
                                                </div>

                                                <div className="shrink-0 flex items-center gap-2">
                                                    {syncStatus === 'SYNCED' && (
                                                        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 h-5 gap-1">
                                                            <Check className="w-3 h-3" /> Synced
                                                        </Badge>
                                                    )}

                                                    {syncStatus === 'PENDING' && field.currentValue && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10px] px-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                                            onClick={async () => {
                                                                toast.promise(
                                                                    applyMasterToQuestion(q.id, field.currentValue, "CURRENT_USER", "/app/le/[id]/workbench"),
                                                                    {
                                                                        loading: 'Syncing...',
                                                                        success: 'Question updated from Master Data',
                                                                        error: 'Failed to update'
                                                                    }
                                                                );
                                                                onUpdate?.();
                                                            }}
                                                        >
                                                            Accept Master
                                                        </Button>
                                                    )}

                                                    {syncStatus === 'CONFLICT' && field.currentValue && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10px] px-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                                                            onClick={async () => {
                                                                toast.promise(
                                                                    applyMasterToQuestion(q.id, field.currentValue, "CURRENT_USER", "/app/le/[id]/workbench"),
                                                                    {
                                                                        loading: 'Syncing...',
                                                                        success: 'Question updated from Master Data',
                                                                        error: 'Failed to update'
                                                                    }
                                                                );
                                                                onUpdate?.();
                                                            }}
                                                        >
                                                            <Sparkles className="w-3 h-3 mr-1" />
                                                            Sync
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

            </CardContent>
        </Card>
    );
}
