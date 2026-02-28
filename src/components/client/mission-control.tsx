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
import { ACTIVITY_META, LEActivityTypeValue } from "@/lib/le-activity-schema";

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
        pipeline: Array<{ id: string; fiName: string; status: string; isInvited?: boolean; isAccepted?: boolean; addedDate?: Date | null; invitedDate?: Date | null; acceptedDate?: Date | null }>;
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

            {/* Relationships */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500" />
                        Relationships
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col">
                        {metrics.pipeline.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm m-4 border-2 border-dashed border-slate-100 rounded-lg">
                                No relationships yet.
                            </div>
                        ) : (
                            <>
                                {/* Table Header */}
                                <div className="grid grid-cols-[1fr_120px_120px_120px] gap-4 px-6 py-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider items-center">
                                    <div>Supplier</div>
                                    <div className="text-center">Added</div>
                                    <div className="text-center">Invited</div>
                                    <div className="text-center">Accepted</div>
                                </div>
                                {/* Table Body */}
                                <div className="divide-y divide-slate-100">
                                    {metrics.pipeline.map(bank => (
                                        <div key={bank.id} className="grid grid-cols-[1fr_120px_120px_120px] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center text-slate-600 shrink-0 border border-slate-200 shadow-sm">
                                                    <Building2 className="h-4 w-4" />
                                                </div>
                                                <div className="font-medium text-slate-900 truncate">
                                                    {bank.fiName}
                                                </div>
                                            </div>

                                            {/* Added */}
                                            <div className="flex justify-center text-sm text-slate-500">
                                                {bank.addedDate ? new Date(bank.addedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                            </div>

                                            {/* Invited */}
                                            <div className="flex justify-center flex-col items-center">
                                                {bank.isInvited ? (
                                                    <span className="text-sm font-medium text-slate-700">
                                                        {bank.invitedDate ? new Date(bank.invitedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Yes'}
                                                    </span>
                                                ) : (
                                                    <Badge variant="outline" className="bg-slate-100/50 text-slate-400 border-dashed border-slate-200 font-normal">
                                                        Waitlist
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Accepted */}
                                            <div className="flex justify-center flex-col items-center">
                                                {bank.isAccepted ? (
                                                    <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {bank.acceptedDate ? new Date(bank.acceptedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Yes'}
                                                    </span>
                                                ) : bank.isInvited ? (
                                                    <span className="text-xs text-slate-400 italic">Pending</span>
                                                ) : (
                                                    <span className="text-sm text-slate-300">-</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
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
