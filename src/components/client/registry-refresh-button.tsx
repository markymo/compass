"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2 } from "lucide-react";
import { refreshLocalRegistryData } from "@/actions/registry";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RegistryRefreshButtonProps {
    leId: string;
    lastRefreshed?: Date | string | null;
    className?: string; // Allow custom styling
}

export function RegistryRefreshButton({ leId, lastRefreshed, className }: RegistryRefreshButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleRefresh = async () => {
        setIsLoading(true);
        try {
            const result = await refreshLocalRegistryData(leId);
            if (result.success) {
                toast.success("Registry data updated successfully");
            } else {
                toast.error(result.error || "Failed to update registry data");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error during refresh");
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
