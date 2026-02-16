"use client";



import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Activity, Building2, CheckCircle2,
    Clock, LayoutDashboard, Zap
} from "lucide-react";
import { motion } from "framer-motion";
import { ProgressTracker } from "@/components/shared/progress-tracker";
import { DashboardMetric } from "@/lib/metrics-calc";

interface MissionControlProps {
    leId: string;
    engagements: any[];
    metrics: {
        readiness: {
            total: number;
            standingData: number;
            questionnaires: number;
            details: any;
            metrics?: DashboardMetric; // Optional until backend fully propagated
        };
        pipeline: Array<{ id: string; fiName: string; status: string }>;
        activity: Array<{ id: string; action: string; time: Date; user: string }>;
    };
}

export function MissionControl({ metrics, leId, engagements }: MissionControlProps) {

    // Pipeline Stages Logic
    const pipelineStages = [
        { id: "INVITED", label: "Invited", icon: Clock },
        { id: "CONNECTED", label: "Connected", icon: CheckCircle2 },
        // Future: Add "VERIFIED" etc if we implement computed status here
    ];

    const getStageForStatus = (status: string) => {
        if (status === "PREPARATION") return "INVITED"; // Map preparation to bucket 1 or hide it
        if (["INVITED"].includes(status)) return "INVITED";
        if (status === "CONNECTED") return "CONNECTED";
        if (status === "ARCHIVED") return "ARCHIVED";
        return "INVITED";
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* TOP ROW: Progress Tracker */}
            {/* TOP ROW: Progress Tracker */}
            {/* TOP ROW: Progress Tracker */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center justify-center">
                {metrics.readiness.metrics ? (
                    <ProgressTracker metrics={metrics.readiness.metrics} variant="header" className="w-full max-w-5xl" />
                ) : (
                    <div className="text-center text-slate-400 text-sm">Loading metrics...</div>
                )}
            </div>

            {/* MIDDLE ROW: Pipeline Visualization */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-slate-500" />
                        Supplier Relationship Pipeline
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="relative flex justify-between">
                        {/* Connecting Line */}
                        <div className="absolute top-[15px] left-0 w-full h-0.5 bg-slate-200 -z-10" />

                        {pipelineStages.map((stage, idx) => {
                            const banksInStage = metrics.pipeline.filter(p => getStageForStatus(p.status) === stage.id);
                            const Icon = stage.icon;

                            return (
                                <div key={stage.id} className="flex flex-col items-center flex-1">
                                    {/* Stage Node */}
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center mb-4 z-10 shadow-sm">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                    </div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">{stage.label}</h4>

                                    {/* Banks Cards Stack */}
                                    <div className="space-y-2 w-full px-4">
                                        {banksInStage.length === 0 ? (
                                            <div className="h-12 border-2 border-dashed border-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-300">
                                                No Banks
                                            </div>
                                        ) : (
                                            banksInStage.map(bank => (
                                                <div key={bank.id} className="bg-white border hover:border-indigo-300 shadow-sm p-3 rounded-lg flex items-center gap-3 transition-all cursor-pointer group">
                                                    <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <div className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                                                        {bank.fiName}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* BOTTOM ROW: Activity Feed */}
            <Card className="border-slate-200 shadow-sm relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-500" />
                        Live Activity Pulse
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-400 border-slate-200">
                        Design Pending
                    </Badge>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {metrics.activity.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-8 italic">
                                No recent activity recorded.
                            </div>
                        ) : (
                            metrics.activity.map((log, i) => (
                                <div key={log.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2" />
                                        {i < metrics.activity.length - 1 && <div className="w-px h-full bg-slate-100 my-1" />}
                                    </div>
                                    <div className="pb-2">
                                        <p className="text-sm font-medium text-slate-900">
                                            <span className="font-bold">{log.user}</span> {log.action.toLowerCase().replace(/_/g, ' ')}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(log.time).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
