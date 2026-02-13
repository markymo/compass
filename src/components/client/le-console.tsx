"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TrendingDown, Clock, AlertCircle, Save } from "lucide-react";
import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups";
import { FIELD_DEFINITIONS } from "@/domain/kyc/FieldDefinitions";
import { useState, useEffect } from "react";
import { resolveMasterData, getConsoleQuestions, ConsoleQuestion, ResolverResponse } from "@/actions/kyc-query";

interface LEConsoleProps {
    leId: string;
}

export function LEConsole({ leId }: LEConsoleProps) {
    // Real Data State
    const [questions, setQuestions] = useState<ConsoleQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Mock Data for Boilerplate Stats (Keep for now until we compute real stats)
    const totalQuestions = questions.length;
    const answeredQuestions = questions.filter(q => q.status === "ANSWERED").length;
    const progressPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

    // State for inputs (mocking form state)
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [hydrated, setHydrated] = useState<ResolverResponse>({}); // Track which fields are from Master Data

    // Hydration Effect
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Questions
                const fetchedQuestions = await getConsoleQuestions(leId);
                setQuestions(fetchedQuestions);

                if (fetchedQuestions.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // 2. Prepare Hydration Request
                const request = fetchedQuestions.map(q => ({
                    questionId: q.id,
                    masterFieldNo: q.masterFieldNo,
                    masterQuestionGroupId: q.masterQuestionGroupId
                }));

                // 3. Hydrate from Master Data
                const resolved = await resolveMasterData(leId, request);
                setHydrated(resolved);
            } catch (error) {
                console.error("Failed to load console data", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [leId]);

    const handleInputChange = (fieldNo: number, value: string) => {
        setFormState(prev => ({ ...prev, [fieldNo]: value }));
    };

    if (isLoading) {
        return <div className="p-10 text-center text-slate-400">Loading console...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Top Stats Bar */}
            <div className="grid grid-cols-12 gap-4 h-32">
                <Card className="col-span-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                    <CardContent className="p-5 space-y-3">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Completion</p>
                                <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                                    {answeredQuestions} <span className="text-slate-300 text-lg">/ {totalQuestions}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-blue-600">{Math.round(progressPercentage)}%</span>
                            </div>
                        </div>
                        <Progress value={progressPercentage} className="h-2 bg-slate-100" />
                    </CardContent>
                </Card>

                <Card className="col-span-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 relative overflow-hidden">
                    <CardContent className="p-5 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start z-10">
                            <div className="flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-emerald-500" />
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Burndown Velocity</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">On Track</Badge>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-20 opacity-80">
                            <div className="w-full h-full bg-gradient-to-t from-blue-50 to-transparent" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5 h-full flex items-center justify-center text-slate-400 text-sm">
                        Recent Activity Placeholder
                    </CardContent>
                </Card>
            </div>

            {/* Main Console Workspace */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold tracking-tight">Incoming Questions</h2>
                    <Badge variant="secondary">{questions.filter(q => q.status === "OPEN").length} Pending</Badge>
                </div>

                <div className="grid gap-4">
                    {questions.map((question) => {
                        // 1. Resolve Mapping Target
                        let fieldsToRender: number[] = [];
                        let mappingType: "SINGLE" | "GROUP" | "NONE" = "NONE";
                        let mappingLabel = "Unmapped";

                        if (question.masterQuestionGroupId) {
                            const group = FIELD_GROUPS[question.masterQuestionGroupId];
                            if (group) {
                                fieldsToRender = group.fieldNos;
                                mappingType = "GROUP";
                                mappingLabel = `Group: ${group.label}`;
                            }
                        } else if (question.masterFieldNo) {
                            fieldsToRender = [question.masterFieldNo];
                            mappingType = "SINGLE";
                            mappingLabel = `Field: ${FIELD_DEFINITIONS[question.masterFieldNo]?.fieldName || question.masterFieldNo}`;
                        }

                        return (
                            <Card key={question.id} className="border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex">
                                    {/* Left: Question Context */}
                                    <div className="w-1/3 bg-slate-50 dark:bg-slate-900/50 p-6 border-r border-slate-100 dark:border-slate-800">
                                        <Badge variant="outline" className="mb-2 text-xs font-mono text-slate-500">
                                            {question.category}
                                        </Badge>
                                        <p className="font-medium text-slate-800 dark:text-slate-200">{question.text}</p>

                                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                                            <div className={`w-2 h-2 rounded-full ${mappingType !== "NONE" ? "bg-green-500" : "bg-amber-500"}`} />
                                            <span>{mappingLabel}</span>
                                        </div>
                                    </div>

                                    {/* Right: Working Area */}
                                    <div className="w-2/3 p-6 space-y-4">
                                        {mappingType === "NONE" ? (
                                            <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-lg border-2 border-dashed">
                                                No Master Data mapping found.
                                                <Button size="sm" variant="link" className="text-blue-600">Map via AI</Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {/* Composite Field Inputs */}
                                                <div className="grid gap-4">
                                                    {fieldsToRender.map(fieldNo => {
                                                        const def = FIELD_DEFINITIONS[fieldNo];
                                                        return (
                                                            <div key={fieldNo} className="grid grid-cols-12 gap-4 items-center">
                                                                <Label className="col-span-4 text-xs font-medium text-slate-500 text-right uppercase tracking-wide">
                                                                    {def?.fieldName || `Field ${fieldNo}`}
                                                                </Label>
                                                                <div className="col-span-8">
                                                                    <Input
                                                                        placeholder={`Enter ${def?.fieldName}...`}
                                                                        className="h-9"
                                                                        value={formState[fieldNo] || ""}
                                                                        onChange={(e) => handleInputChange(fieldNo, e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                <Separator />

                                                <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-md border border-blue-100">
                                                    <div className="flex items-center gap-2 text-sm text-blue-700">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <span>
                                                            {mappingType === "GROUP"
                                                                ? "Updates Master Data for all fields in this group."
                                                                : "Updates Master Data for this single field."}
                                                        </span>
                                                    </div>
                                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
                                                        <Save className="h-4 w-4" />
                                                        Apply & Resolve
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
