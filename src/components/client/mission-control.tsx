"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Activity, ArrowRight, Building2, CheckCircle2,
    Clock, Database, FileText, AlertCircle,
    Check, LayoutDashboard, Zap
} from "lucide-react";
import { motion } from "framer-motion";

interface MissionControlProps {
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

export function MissionControl({ metrics }: MissionControlProps) {

    // Pipeline Stages Logic
    const pipelineStages = [
        { id: "PREPARATION", label: "Preparation", icon: Database },
        { id: "PENDING", label: "Under Review", icon: Clock },
        { id: "QUERIES_OPEN", label: "Queries Open", icon: AlertCircle },
        { id: "SIGNED_OFF", label: "Signed Off", icon: CheckCircle2 },
    ];

    const getStageForStatus = (status: string) => {
        if (status === "PREPARATION") return "PREPARATION";
        if (["PENDING", "REVIEWING"].includes(status)) return "PENDING";
        if (status === "QUERIES_OPEN") return "QUERIES_OPEN";
        if (status === "SIGNED_OFF") return "SIGNED_OFF";
        return "PREPARATION";
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* TOP ROW: Readiness Gauge & Key Stats */}
            <div className="grid gap-8 md:grid-cols-3">

                {/* 1. The North Star Gauge */}
                <Card className="md:col-span-1 border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-4 w-4 text-purple-600" />
                            Onboarding Readiness
                        </CardTitle>
                        <CardDescription>Your data completeness score</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center pt-6 pb-8">
                        <div className="relative h-40 w-40 flex items-center justify-center">
                            {/* SVG Gauge */}
                            <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                <motion.circle
                                    cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="8"
                                    strokeDasharray="283"
                                    initial={{ strokeDashoffset: 283 }}
                                    animate={{ strokeDashoffset: 283 - (283 * metrics.readiness.total) / 100 }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-bold text-slate-900">{metrics.readiness.total}%</span>
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Ready</span>
                            </div>
                        </div>

                        <div className="w-full mt-6 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 flex items-center gap-2">
                                    <Database className="h-3.5 w-3.5" /> Standing Data
                                </span>
                                <span className="font-semibold text-slate-900">{Math.round((metrics.readiness.standingData / 60) * 100)}%</span>
                            </div>
                            <Progress value={(metrics.readiness.standingData / 60) * 100} className="h-1.5 bg-slate-100" />

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5" /> Questionnaires
                                </span>
                                <span className="font-semibold text-slate-900">{Math.round((metrics.readiness.questionnaires / 40) * 100)}%</span>
                            </div>
                            <Progress value={(metrics.readiness.questionnaires / 40) * 100} className="h-1.5 bg-slate-100" />
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Action Center / Smart Alerts */}
                <div className="md:col-span-2 grid gap-4 grid-rows-2">
                    {/* Top Alert: Most Critical */}
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 flex items-start gap-4 shadow-sm">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 text-lg">Missing Key Document</h3>
                            <p className="text-slate-600 text-sm mt-1 mb-3">
                                You have not uploaded your <span className="font-semibold">Certificate of Incorporation</span> yet. This is required for 3 active banking engagements.
                            </p>
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm border-amber-700">
                                Upload Now
                            </Button>
                        </div>
                    </div>

                    {/* Secondary Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="border-slate-200 shadow-sm flex flex-col justify-center px-6">
                            <div className="text-sm font-medium text-slate-500 mb-1">Active Banks</div>
                            <div className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                                {metrics.pipeline.length}
                                <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+1 this week</span>
                            </div>
                        </Card>
                        <Card className="border-slate-200 shadow-sm flex flex-col justify-center px-6">
                            <div className="text-sm font-medium text-slate-500 mb-1">Questions Answered</div>
                            <div className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                                {metrics.readiness.details.questionsAnswered}
                                <span className="text-sm font-normal text-slate-400">/ {metrics.readiness.details.totalQuestions}</span>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* MIDDLE ROW: Pipeline Visualization */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-slate-500" />
                        Banking Relationship Pipeline
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
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-500" />
                        Live Activity Pulse
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {metrics.activity.map((log, i) => (
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
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
