"use client";

import { Button as RealButton } from "@/components/ui/button";
import { clearDefinitionCache } from "@/actions/master-data-governance";
import { useState } from "react";
import { RefreshCw, Trash2, CheckCircle, AlertCircle } from "lucide-react";

export function MasterDataSystemTools() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    async function handleClearCache() {
        setLoading(true);
        setStatus('idle');
        const res = await clearDefinitionCache();
        setLoading(false);
        if (res.success) {
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } else {
            setStatus('error');
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-md">
                        <RefreshCw className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight text-xs">Definition Cache</h4>
                        <p className="text-xs text-slate-500 max-w-[400px]">
                            Atomic fields are cached for 30 seconds to optimize performance.
                            Clear the cache to force immediate propagation of changes across the workbench.
                        </p>
                    </div>
                </div>
                <RealButton
                    onClick={handleClearCache}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                >
                    {loading ? (
                        <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                    ) : status === 'success' ? (
                        <CheckCircle className="h-3 w-3 text-emerald-500 mr-2" />
                    ) : status === 'error' ? (
                        <AlertCircle className="h-3 w-3 text-red-500 mr-2" />
                    ) : (
                        <Trash2 className="h-3 w-3 mr-2" />
                    )}
                    {status === 'success' ? 'Cache Cleared' : 'Invalidate Cache'}
                </RealButton>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/30">
                <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-white dark:bg-slate-900 rounded-md shadow-sm border border-red-100 dark:border-red-900/20">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-900 dark:text-red-400 uppercase tracking-tight text-xs">Schema Reset (DANGER)</h4>
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
