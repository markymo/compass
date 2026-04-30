"use client";

import { useState, useEffect, useTransition } from "react";
import { Button as RealButton } from "@/components/ui/button";
import { clearDefinitionCache } from "@/actions/master-data-governance";
import { publishMasterSchema, activateMasterSchema, getMasterSchemaVersions } from "@/actions/publish-schema";
import {
    RefreshCw,
    Trash2,
    CheckCircle,
    AlertCircle,
    BookMarked,
    Zap,
    ChevronDown,
    ChevronUp,
    Database,
} from "lucide-react";

type SchemaVersion = {
    id: string;
    version: number;
    isActive: boolean;
    publishedAt: string;
    fieldCount: number;
    mappingCount: number;
    createdAt: Date;
};

export function MasterDataSystemTools() {
    // ── Cache tool state ──────────────────────────────────────────────────
    const [cacheLoading, setCacheLoading] = useState(false);
    const [cacheStatus, setCacheStatus] = useState<"idle" | "success" | "error">("idle");

    // ── Schema publish state ──────────────────────────────────────────────
    const [versions, setVersions] = useState<SchemaVersion[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(true);
    const [showVersions, setShowVersions] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [publishStatus, setPublishStatus] = useState<"idle" | "success" | "error">("idle");
    const [publishMessage, setPublishMessage] = useState("");
    const [activatingId, setActivatingId] = useState<string | null>(null);

    // ── Load versions on mount ─────────────────────────────────────────────
    useEffect(() => {
        loadVersions();
    }, []);

    async function loadVersions() {
        setVersionsLoading(true);
        const res = await getMasterSchemaVersions();
        if (res.success && res.versions) setVersions(res.versions);
        setVersionsLoading(false);
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    async function handleClearCache() {
        setCacheLoading(true);
        setCacheStatus("idle");
        const res = await clearDefinitionCache();
        setCacheLoading(false);
        setCacheStatus(res.success ? "success" : "error");
        if (res.success) setTimeout(() => setCacheStatus("idle"), 3000);
    }

    function handlePublish() {
        startTransition(async () => {
            setPublishStatus("idle");
            const res = await publishMasterSchema();
            if (res.success) {
                setPublishStatus("success");
                setPublishMessage(
                    `v${res.schema.version} published — ${res.fieldCount} fields, ${res.mappingCount} mappings. Not yet active.`
                );
                await loadVersions();
                setShowVersions(true);
                setTimeout(() => setPublishStatus("idle"), 5000);
            } else {
                setPublishStatus("error");
                setPublishMessage(res.error);
            }
        });
    }

    async function handleActivate(schemaId: string) {
        setActivatingId(schemaId);
        const res = await activateMasterSchema(schemaId);
        setActivatingId(null);
        if (res.success) {
            await loadVersions();
        } else {
            alert(`Activation failed: ${res.error}`);
        }
    }

    const activeVersion = versions.find((v) => v.isActive);

    return (
        <div className="space-y-4">
            {/* ── Definition Cache ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-md">
                        <RefreshCw className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight text-xs">
                            Definition Cache
                        </h4>
                        <p className="text-xs text-slate-500 max-w-[400px]">
                            Atomic fields are cached for 30 seconds to optimize performance. Clear to force
                            immediate propagation of changes across the workbench.
                        </p>
                    </div>
                </div>
                <RealButton
                    onClick={handleClearCache}
                    disabled={cacheLoading}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                >
                    {cacheLoading ? (
                        <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                    ) : cacheStatus === "success" ? (
                        <CheckCircle className="h-3 w-3 text-emerald-500 mr-2" />
                    ) : cacheStatus === "error" ? (
                        <AlertCircle className="h-3 w-3 text-red-500 mr-2" />
                    ) : (
                        <Trash2 className="h-3 w-3 mr-2" />
                    )}
                    {cacheStatus === "success" ? "Cache Cleared" : "Invalidate Cache"}
                </RealButton>
            </div>

            {/* ── Schema Publish ───────────────────────────────────────────── */}
            <div className="border rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
                            <BookMarked className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight text-xs">
                                Schema Snapshot
                            </h4>
                            <p className="text-xs text-slate-500 max-w-[400px]">
                                Publish an immutable snapshot of all active fields and source mappings.
                                {activeVersion
                                    ? ` Active: v${activeVersion.version} (${activeVersion.fieldCount} fields, ${activeVersion.mappingCount} mappings).`
                                    : " No active version."}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <RealButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowVersions((v) => !v)}
                            className="text-xs text-slate-500"
                        >
                            {showVersions ? (
                                <ChevronUp className="h-3 w-3 mr-1" />
                            ) : (
                                <ChevronDown className="h-3 w-3 mr-1" />
                            )}
                            {versions.length} version{versions.length !== 1 ? "s" : ""}
                        </RealButton>
                        <RealButton
                            onClick={handlePublish}
                            disabled={isPending}
                            size="sm"
                            variant="outline"
                            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400"
                        >
                            {isPending ? (
                                <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                            ) : publishStatus === "success" ? (
                                <CheckCircle className="h-3 w-3 text-emerald-500 mr-2" />
                            ) : publishStatus === "error" ? (
                                <AlertCircle className="h-3 w-3 text-red-500 mr-2" />
                            ) : (
                                <Database className="h-3 w-3 mr-2" />
                            )}
                            Publish Snapshot
                        </RealButton>
                    </div>
                </div>

                {/* Status message */}
                {publishMessage && (publishStatus === "success" || publishStatus === "error") && (
                    <div
                        className={`px-4 pb-3 text-xs ${
                            publishStatus === "success"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                        }`}
                    >
                        {publishMessage}
                    </div>
                )}

                {/* Version history table */}
                {showVersions && (
                    <div className="border-t border-slate-100 dark:border-slate-800">
                        {versionsLoading ? (
                            <div className="p-4 text-xs text-slate-400 flex items-center gap-2">
                                <RefreshCw className="h-3 w-3 animate-spin" /> Loading versions…
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="p-4 text-xs text-slate-400">No schema versions published yet.</div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-slate-400 uppercase tracking-wider">
                                        <th className="px-4 py-2 font-medium">Version</th>
                                        <th className="px-4 py-2 font-medium">Fields</th>
                                        <th className="px-4 py-2 font-medium">Mappings</th>
                                        <th className="px-4 py-2 font-medium">Published</th>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                        <th className="px-4 py-2 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {versions.map((v) => (
                                        <tr
                                            key={v.id}
                                            className={`border-b border-slate-50 dark:border-slate-900 ${
                                                v.isActive
                                                    ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                                                    : ""
                                            }`}
                                        >
                                            <td className="px-4 py-2 font-mono font-semibold text-slate-700 dark:text-slate-300">
                                                v{v.version}
                                            </td>
                                            <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                                                {v.fieldCount}
                                            </td>
                                            <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                                                {v.mappingCount}
                                            </td>
                                            <td className="px-4 py-2 text-slate-400">
                                                {new Date(v.publishedAt).toLocaleDateString("en-GB", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>
                                            <td className="px-4 py-2">
                                                {v.isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                                        <CheckCircle className="h-3 w-3" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">Inactive</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {!v.isActive && (
                                                    <RealButton
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleActivate(v.id)}
                                                        disabled={activatingId === v.id}
                                                        className="text-xs h-6 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                    >
                                                        {activatingId === v.id ? (
                                                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                                        ) : (
                                                            <Zap className="h-3 w-3 mr-1" />
                                                        )}
                                                        Activate
                                                    </RealButton>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* ── Schema Reset (danger) ─────────────────────────────────────── */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/30">
                <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-white dark:bg-slate-900 rounded-md shadow-sm border border-red-100 dark:border-red-900/20">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-900 dark:text-red-400 uppercase tracking-tight text-xs">
                            Schema Reset (DANGER)
                        </h4>
                        <p className="text-xs text-red-500 max-w-[400px]">
                            Re-run the seeder script to reset definition orders and categories to defaults.
                            This will NOT delete KYC data, but may move fields around in the UI.
                        </p>
                    </div>
                </div>
                <RealButton
                    variant="destructive"
                    size="sm"
                    className="shrink-0 opacity-50 cursor-not-allowed"
                    disabled
                >
                    Run Seeder
                </RealButton>
            </div>
        </div>
    );
}
