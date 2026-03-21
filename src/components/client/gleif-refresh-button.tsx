"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2 } from "lucide-react";
import { refreshGleifData } from "@/actions/gleif-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GleifRefreshButtonProps {
    leId: string;
    lastRefreshed?: Date | string | null;
    className?: string;
}

export function GleifRefreshButton({ leId, lastRefreshed, className }: GleifRefreshButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleRefresh = async () => {
        setIsLoading(true);
        try {
            const result = await refreshGleifData(leId);
            if (result.success) {
                toast.success("GLEIF data updated successfully");
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
                    <span className="text-xs text-emerald-700/60 dark:text-emerald-300/60 hidden sm:inline-block">
                        Last Refreshed: {new Date(lastRefreshed).toLocaleString()}
                    </span>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="h-8 border-emerald-200 text-emerald-700 hover:text-emerald-900 hover:border-emerald-300 transition-colors bg-white/50"
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
                <span className="text-[10px] text-emerald-600/50 sm:hidden">
                    {new Date(lastRefreshed).toLocaleDateString()}
                </span>
            )}
        </div>
    );
}
