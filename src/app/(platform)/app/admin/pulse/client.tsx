"use client";

import { useState } from "react";
import {
    Activity, Users, LogIn, TrendingUp, TrendingDown,
    Eye, Snowflake, Flame, AlertTriangle, Clock,
    ChevronDown, ChevronUp, Filter
} from "lucide-react";
import { getPulseData } from "@/actions/pulse";

// ============================================================================
// Types — mirrors getPulseData return shape
// ============================================================================

type PulseData = {
    summary: {
        totalLogins: number;
        uniqueUsers: number;
        totalActions: number;
        period: string;
        env: string;
    };
    userActivity: Array<{
        userId: string;
        name: string;
        email: string;
        isDemoActor: boolean;
        orgName: string;
        totalActions: number;
        loginCount: number;
        lastActive: string | Date;
        topPage: string;
        actionBreakdown: Record<string, number>;
    }>;
    dailyTrend: Array<Record<string, any>>;
    leHealth: Array<{
        id: string;
        name: string;
        ownerOrg: string;
        teamSize: number;
        lastActivity: string | Date | null;
        daysSinceActivity: number | null;
        activeUsers: number;
        questionsAnswered: number;
        totalEvents: number;
        status: string;
    }>;
};

// ============================================================================
// Main Client Component
// ============================================================================

export function PulseClient({ data: initialData }: { data: PulseData }) {
    const [data, setData] = useState<PulseData>(initialData);
    const [showAllEnvs, setShowAllEnvs] = useState(false);
    const [hideDemoActors, setHideDemoActors] = useState(true);
    const [loading, setLoading] = useState(false);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    const toggleEnv = async () => {
        setLoading(true);
        const newVal = !showAllEnvs;
        const result = await getPulseData({ days: 30, includeAllEnvs: newVal });
        if (result.success && result.data) {
            setData(result.data);
            setShowAllEnvs(newVal);
        }
        setLoading(false);
    };

    const filteredUsers = hideDemoActors
        ? data.userActivity.filter(u => !u.isDemoActor)
        : data.userActivity;

    return (
        <div className="space-y-8">
            {/* Control bar */}
            <div className="flex items-center gap-3 text-sm">
                <button
                    onClick={toggleEnv}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-600"
                >
                    <Filter className="h-3.5 w-3.5" />
                    {showAllEnvs ? "All environments" : "Production only"}
                </button>
                <label className="flex items-center gap-2 text-slate-500 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={hideDemoActors}
                        onChange={() => setHideDemoActors(!hideDemoActors)}
                        className="rounded border-slate-300"
                    />
                    Hide demo actors
                </label>
                {loading && <span className="text-slate-400 animate-pulse">Refreshing…</span>}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    {
                        label: "Unique Users",
                        value: data.summary.uniqueUsers,
                        icon: <Users className="h-4 w-4 text-indigo-500" />,
                        color: "text-indigo-700 bg-indigo-50 border-indigo-200"
                    },
                    {
                        label: "Total Logins",
                        value: data.summary.totalLogins,
                        icon: <LogIn className="h-4 w-4 text-emerald-500" />,
                        color: "text-emerald-700 bg-emerald-50 border-emerald-200"
                    },
                    {
                        label: "Total Actions",
                        value: data.summary.totalActions,
                        icon: <Activity className="h-4 w-4 text-blue-500" />,
                        color: "text-blue-700 bg-blue-50 border-blue-200"
                    },
                    {
                        label: "Env",
                        value: data.summary.env === "all" ? "All" : "Prod",
                        icon: <Eye className="h-4 w-4 text-slate-500" />,
                        color: "text-slate-700 bg-slate-50 border-slate-200"
                    },
                ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                        <div className="flex items-center gap-2 mb-1">
                            {s.icon}
                            <span className="text-xs font-medium opacity-70">{s.label}</span>
                        </div>
                        <div className="text-3xl font-bold">{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Section A: User Activity Table */}
            <section>
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" />
                    User Activity
                </h2>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-4 py-3 font-medium text-slate-500">User</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-500">Organization</th>
                                <th className="text-right px-4 py-3 font-medium text-slate-500">Logins</th>
                                <th className="text-right px-4 py-3 font-medium text-slate-500">Actions</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-500">Last Active</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-500">Most Visited</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        No user activity in this period.
                                    </td>
                                </tr>
                            )}
                            {filteredUsers.map(user => {
                                const lastActive = new Date(user.lastActive);
                                const daysAgo = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
                                const isExpanded = expandedUser === user.userId;

                                return (
                                    <tr key={user.userId} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-800">{user.name}</div>
                                            <div className="text-xs text-slate-400">{user.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{user.orgName}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-700">{user.loginCount}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-700">{user.totalActions}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`inline-block w-2 h-2 rounded-full ${daysAgo <= 1 ? "bg-emerald-500" :
                                                        daysAgo <= 7 ? "bg-amber-500" :
                                                            "bg-red-400"
                                                    }`} />
                                                <span className="text-slate-600">
                                                    {daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate font-mono">
                                            {user.topPage || "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setExpandedUser(isExpanded ? null : user.userId)}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Expanded breakdown */}
                    {expandedUser && (() => {
                        const user = filteredUsers.find(u => u.userId === expandedUser);
                        if (!user) return null;
                        return (
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                                <div className="text-xs font-medium text-slate-500 mb-2">Action Breakdown for {user.name}</div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(user.actionBreakdown)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([action, count]) => (
                                            <span
                                                key={action}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white border border-slate-200 text-slate-600"
                                            >
                                                <span className="font-mono font-medium">{count}</span>
                                                <span className="text-slate-400">×</span>
                                                <span>{action}</span>
                                            </span>
                                        ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </section>

            {/* Section B: Daily Trend */}
            <section>
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Daily Activity Trend
                </h2>
                <div className="rounded-xl border border-slate-200 p-6 bg-white">
                    {data.dailyTrend.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4">No data for this period.</p>
                    ) : (
                        <div className="space-y-1">
                            {/* Simple horizontal bar chart */}
                            {data.dailyTrend.map(day => {
                                const max = Math.max(...data.dailyTrend.map(d => d._total || 0));
                                const pct = max > 0 ? ((day._total || 0) / max) * 100 : 0;
                                return (
                                    <div key={day.date} className="flex items-center gap-3 group">
                                        <span className="text-xs text-slate-400 font-mono w-20 shrink-0">
                                            {new Date(day.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                        </span>
                                        <div className="flex-1 h-6 bg-slate-50 rounded overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-indigo-400 to-blue-500 rounded transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono text-slate-500 w-8 text-right">
                                            {day._total || 0}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Section C: LE Engagement Health */}
            <section>
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    Legal Entity Health
                </h2>
                <div className="grid gap-3">
                    {data.leHealth.length === 0 && (
                        <p className="text-slate-400 text-sm">No active Legal Entities.</p>
                    )}
                    {data.leHealth.map(le => {
                        const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string; border: string }> = {
                            active: {
                                icon: <Flame className="h-4 w-4" />,
                                label: "Active",
                                color: "text-emerald-700 bg-emerald-50",
                                border: "border-emerald-200"
                            },
                            cooling: {
                                icon: <Clock className="h-4 w-4" />,
                                label: "Cooling",
                                color: "text-amber-700 bg-amber-50",
                                border: "border-amber-200"
                            },
                            cold: {
                                icon: <Snowflake className="h-4 w-4" />,
                                label: "Cold",
                                color: "text-blue-700 bg-blue-50",
                                border: "border-blue-200"
                            },
                            no_activity: {
                                icon: <AlertTriangle className="h-4 w-4" />,
                                label: "No activity",
                                color: "text-red-700 bg-red-50",
                                border: "border-red-200"
                            },
                        };
                        const sc = statusConfig[le.status] || statusConfig.no_activity;

                        return (
                            <div
                                key={le.id}
                                className={`rounded-xl border ${sc.border} p-4 flex items-center justify-between`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`rounded-lg p-2 ${sc.color}`}>
                                        {sc.icon}
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-800">{le.name}</div>
                                        <div className="text-xs text-slate-400">{le.ownerOrg}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-sm">
                                    <div className="text-center">
                                        <div className="font-mono font-medium text-slate-700">{le.activeUsers}</div>
                                        <div className="text-xs text-slate-400">Active users</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-mono font-medium text-slate-700">{le.questionsAnswered}</div>
                                        <div className="text-xs text-slate-400">Qs answered</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-mono font-medium text-slate-700">{le.totalEvents}</div>
                                        <div className="text-xs text-slate-400">Total events</div>
                                    </div>
                                    <div className="text-center min-w-[80px]">
                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                                            {sc.icon}
                                            {sc.label}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {le.lastActivity
                                                ? new Date(le.lastActivity).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                                : "Never"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
