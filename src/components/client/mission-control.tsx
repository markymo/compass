"use client";

import Link from "next/link";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Activity, ArrowRight, Building2, CheckCircle2,
    Clock, LayoutDashboard, Zap
} from "lucide-react";
import { motion } from "framer-motion";

interface MissionControlProps {
    leId: string;
    engagements: any[];
    metrics: {
        readiness: {
            total: number;
            standingData: number;
            questionnaires: number;
            details: any;
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

            {/* TOP ROW: Readiness Gauge & Key Stats */}
            <div className="grid gap-8 md:grid-cols-3">

                {/* 1. The North Star Gauge */}
                {/* 1. The North Star Gauge REPLACED with "Closing Tracker" (CP List Summary) */}
                <Card className="md:col-span-1 border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-500" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-4 w-4 text-indigo-600" />
                            Closing Tracker
                        </CardTitle>
                        <CardDescription>Conditions Precedent (CP) Status</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center pb-8">

                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-3xl font-bold text-slate-900">
                                    {(metrics.readiness.details as any).cpStatus.draft + (metrics.readiness.details as any).cpStatus.internalReview + (metrics.readiness.details as any).cpStatus.shared}
                                </span>
                                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Pending Items</span>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-medium text-slate-600">Target Funding</span>
                                <div className="text-indigo-600 font-bold">~ 14 Days</div>
                            </div>
                        </div>

                        {/* Ball-in-Court Stacked Bar */}
                        <div className="space-y-2">
                            <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                                {/* Done */}
                                <div
                                    className="bg-emerald-500 h-full"
                                    style={{ width: `${((metrics.readiness.details as any).cpStatus.done / metrics.readiness.details.totalQuestions) * 100}%` }}
                                    title="Done"
                                />
                                {/* External (With Bank) */}
                                <div
                                    className="bg-purple-500 h-full"
                                    style={{ width: `${((metrics.readiness.details as any).cpStatus.shared / metrics.readiness.details.totalQuestions) * 100}%` }}
                                    title="With Bank"
                                />
                                {/* Internal (Drafting + Review) */}
                                <div
                                    className="bg-amber-400 h-full"
                                    style={{ width: `${(((metrics.readiness.details as any).cpStatus.draft + (metrics.readiness.details as any).cpStatus.internalReview) / metrics.readiness.details.totalQuestions) * 100}%` }}
                                    title="Internal Action"
                                />
                            </div>

                            {/* Legend / Key Stats */}
                            <div className="flex justify-between text-xs pt-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span className="text-slate-600">Action: <span className="font-bold text-slate-900">{(metrics.readiness.details as any).cpStatus.draft + (metrics.readiness.details as any).cpStatus.internalReview}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    <span className="text-slate-600">Bank: <span className="font-bold text-slate-900">{(metrics.readiness.details as any).cpStatus.shared}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-slate-600">Done: <span className="font-bold text-slate-900">{(metrics.readiness.details as any).cpStatus.done}</span></span>
                                </div>
                            </div>
                        </div>

                        {/* Mini Velocity / Insight */}
                        <div className="mt-6 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 flex items-start gap-2">
                            <Activity className="h-3.5 w-3.5 text-indigo-500 mt-0.5" />
                            <p>
                                You have <strong>{(metrics.readiness.details as any).cpStatus.draft} items</strong> in drafting.
                                {(metrics.readiness.details as any).cpStatus.shared > 0 ? ` Waiting on Bank for ${(metrics.readiness.details as any).cpStatus.shared} items.` : " Nothing with Bank."}
                            </p>
                        </div>

                    </CardContent>
                </Card>

                {/* 2. Action Center / Smart Alerts - REPURPOSED for just Stats since Alert was mock */}
                <div className="md:col-span-2 flex flex-col justify-center">
                    {/* Secondary Stats */}
                    <div className="grid grid-cols-2 gap-4 h-full max-h-[250px]">
                        <Card className="border-slate-200 shadow-sm flex flex-col p-0 overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Relationship</span>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</span>
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[150px]">
                                {metrics.pipeline && metrics.pipeline.length > 0 ? (
                                    <div className="divide-y divide-slate-50">
                                        {metrics.pipeline.map((p) => (
                                            <Link
                                                key={p.id}
                                                href={`/app/le/${leId}/engagement-new/${p.id}`}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group text-sm"
                                            >
                                                <div className="flex items-center gap-2 truncate pr-2">
                                                    <div className="h-5 w-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                                        <Building2 className="h-3 w-3" />
                                                    </div>
                                                    <span className="font-semibold text-slate-700 group-hover:text-indigo-700 truncate">
                                                        {p.fiName || "Unknown Bank"}
                                                    </span>
                                                </div>
                                                <div className="flexitems-center text-slate-600 font-medium whitespace-nowrap">
                                                    {(p as any).stats ? (
                                                        <>
                                                            <span className="text-slate-900 font-bold">{(p as any).stats.answered}</span>
                                                            <span className="text-slate-400 mx-1">/</span>
                                                            <span className="text-slate-500">{(p as any).stats.total}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 italic text-xs p-4">
                                        No active relationships
                                    </div>
                                )}
                            </div>

                            {/* Summary Footer */}
                            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-600">Total</span>
                                <div className="font-medium">
                                    <span className="text-slate-900 font-bold">{metrics.readiness.details.questionsAnswered}</span>
                                    <span className="text-slate-400 mx-1">/</span>
                                    <span className="text-slate-500">{metrics.readiness.details.totalQuestions}</span>
                                </div>
                            </div>
                        </Card>

                        <Card className="border-slate-200 shadow-sm flex flex-col justify-center px-6">
                            <div className="text-sm font-medium text-slate-500 mb-1">Total Questions Answered</div>
                            <div className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                                {metrics.readiness.details.questionsAnswered}
                                <span className="text-sm font-normal text-slate-400">/ {metrics.readiness.details.totalQuestions}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Aggregate across all relationships</p>
                        </Card>
                    </div>
                </div>
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
