"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2 } from "lucide-react";
import { refreshLocalRegistryData, refreshRegistryReferenceAction } from "@/actions/registry";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RegistryRefreshButtonProps {
    leId: string;
    /** When provided, calls the targeted refreshRegistryReferenceAction instead of the broader bootstrapEntity path. */
    referenceId?: string | null;
    lastRefreshed?: Date | string | null;
    className?: string;
}

export function RegistryRefreshButton({ leId, referenceId, lastRefreshed, className }: RegistryRefreshButtonProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleRefresh = async () => {
        setIsLoading(true);
        try {
            // Prefer the targeted reference refresh when we have a referenceId — it skips
            // the cached-GLEIF bootstrap path and goes directly to the CH connector.
            const result = referenceId
                ? await refreshRegistryReferenceAction(leId, referenceId)
                : await refreshLocalRegistryData(leId);

            if (result.success) {
                toast.success("Registry data updated successfully");
                // Re-render the server component tree so the Sources page immediately
                // reflects the newly written RegistrySourcePayload rows.
                // revalidatePath() alone only marks the cache stale for the next navigation;
                // router.refresh() forces an immediate re-fetch of the current page.
                router.refresh();
            } else {
                toast.error(`Error: ${result.error || "Unknown"}`);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(`Crash: ${error.message || JSON.stringify(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col items-end gap-1", className)}>
            <div className="flex items-center gap-2">
                {lastRefreshed && (
                    <span className="text-xs text-slate-500 hidden sm:inline-block">
                        Last Refreshed: {new Date(lastRefreshed).toLocaleString()}
                    </span>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="h-8 border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                    ) : (
                        <RefreshCcw className="h-3.5 w-3.5 mr-2" />
                    )}
                    Refresh Data
                </Button>
            </div>
            {lastRefreshed && (
                <span className="text-[10px] text-slate-400 sm:hidden">
                    {new Date(lastRefreshed).toLocaleDateString()}
                </span>
            )}
        </div>
    );
}
