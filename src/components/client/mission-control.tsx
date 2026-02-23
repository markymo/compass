"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Activity, Building2, CheckCircle2,
    Clock, LayoutDashboard,
    MessageSquare, Pencil, Upload, Trash2, Send, Link2,
    RefreshCw, UserPlus, Users, UserMinus, ShieldCheck,
    Database, ClipboardList,
} from "lucide-react";
import { ProgressTracker } from "@/components/shared/progress-tracker";
import { DashboardMetric } from "@/lib/metrics-calc";
import { ACTIVITY_META, LEActivityTypeValue } from "@/lib/le-activity";

// Map icon name strings to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
    MessageSquare, Pencil, Upload, Trash2, Send, Link2,
    RefreshCw, UserPlus, Users, UserMinus, ShieldCheck,
    Database, ClipboardList, CheckCircle2,
};

interface ActivityEvent {
    id: string;
    type: LEActivityTypeValue;
    details: Record<string, any> | null;
    createdAt: Date;
    user: { id: string; name: string | null; email: string };
}

interface MissionControlProps {
    leId: string;
    engagements: any[];
    activity?: ActivityEvent[];
    metrics: {
        readiness: {
            total: number;
            standingData: number;
            questionnaires: number;
            details: any;
            metrics?: DashboardMetric;
        };
        pipeline: Array<{ id: string; fiName: string; status: string }>;
        activity: Array<{ id: string; action: string; time: Date; user: string }>;
    };
}

function ActivityEventCard({ event }: { event: ActivityEvent }) {
    const meta = ACTIVITY_META[event.type] ?? {
        label: event.type.toLowerCase().replace(/_/g, " "),
        icon: "Activity",
        colour: "text-slate-600",
        bgColour: "bg-slate-50",
    };
    const Icon = ICON_MAP[meta.icon] ?? Activity;
    const userName = event.user.name || event.user.email.split("@")[0];

    // Build context line from details
    const details = event.details ?? {};
    let context: string | null = null;
    if (details.questionText) context = `"${details.questionText}"`;
    else if (details.docName) context = details.docName;
    else if (details.invitedEmail) context = `${details.invitedEmail} as ${details.role}`;
    else if (details.bankName) context = details.bankName;

    const now = new Date();
    const diff = now.getTime() - new Date(event.createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const timeAgo = days > 0 ? `${days}d ago`
        : hours > 0 ? `${hours}h ago`
            : minutes > 0 ? `${minutes}m ago`
                : "just now";

    return (
        <div className="flex gap-3 items-start">
            <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${meta.bgColour}`}>
                <Icon className={`h-3.5 w-3.5 ${meta.colour}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{userName}</span>
                    {" "}{meta.label}
                </p>
                {context && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{context}</p>
                )}
            </div>
            <span className="text-xs text-slate-400 shrink-0 pt-0.5">{timeAgo}</span>
        </div>
    );
}

export function MissionControl({ metrics, leId, engagements, activity = [] }: MissionControlProps) {

    const pipelineStages = [
        { id: "INVITED", label: "Invited", icon: Clock },
        { id: "CONNECTED", label: "Connected", icon: CheckCircle2 },
    ];

    const getStageForStatus = (status: string) => {
        if (["INVITED", "PREPARATION"].includes(status)) return "INVITED";
        if (status === "CONNECTED") return "CONNECTED";
        return "INVITED";
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Progress Tracker */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <div className="overflow-x-auto pb-2 -mb-2">
                    {metrics.readiness.metrics ? (
                        <ProgressTracker metrics={metrics.readiness.metrics} variant="header" className="min-w-[600px] w-full max-w-5xl mx-auto" />
                    ) : (
                        <div className="text-center text-slate-400 text-sm">Loading metrics...</div>
                    )}
                </div>
            </div>

            {/* Pipeline */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-slate-500" />
                        Supplier Relationship Pipeline
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-8">
                    <div className="relative flex flex-col md:flex-row justify-between gap-8 md:gap-0">
                        <div className="hidden md:block absolute top-[15px] left-0 w-full h-0.5 bg-slate-200 -z-10" />
                        <div className="md:hidden absolute left-[15px] top-0 h-full w-0.5 bg-slate-200 -z-10" />
                        {pipelineStages.map((stage) => {
                            const banksInStage = metrics.pipeline.filter(p => getStageForStatus(p.status) === stage.id);
                            const Icon = stage.icon;
                            return (
                                <div key={stage.id} className="flex flex-row md:flex-col items-start md:items-center flex-1 gap-4 md:gap-0">
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center mb-0 md:mb-4 z-10 shadow-sm shrink-0">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 md:mb-4 mt-1.5 md:mt-0 md:text-center">{stage.label}</h4>
                                        <div className="space-y-2 w-full md:px-4">
                                            {banksInStage.length === 0 ? (
                                                <div className="h-12 border-2 border-dashed border-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-300">No Banks</div>
                                            ) : (
                                                banksInStage.map(bank => (
                                                    <div key={bank.id} className="bg-white border hover:border-indigo-300 shadow-sm p-3 rounded-lg flex items-center gap-3 transition-all cursor-pointer group">
                                                        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                                                            <Building2 className="h-4 w-4" />
                                                        </div>
                                                        <div className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 truncate">{bank.fiName}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Activity Feed */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-500" />
                        Activity
                    </CardTitle>
                    {activity.length > 0 && (
                        <span className="text-xs text-slate-400">{activity.length} recent events</span>
                    )}
                </CardHeader>
                <CardContent>
                    {activity.length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                            <Activity className="h-8 w-8 text-slate-200 mx-auto" />
                            <p className="text-sm text-slate-400">No activity yet.</p>
                            <p className="text-xs text-slate-300">Events will appear here as the team answers questions, uploads documents, and invites members.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activity.map((event) => (
                                <ActivityEventCard key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
