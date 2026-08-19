"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface EnrichmentGateProps {
    leId: string;
    status: string;
    lei?: string;
    raId?: string;
    children: React.ReactNode;
}

/**
 * EnrichmentGate
 * 
 * Provides background enrichment status feedback without blocking the user
 * from viewing or interacting with the ClientLE Master Data page.
 */
export function EnrichmentGate({ leId, status, lei, raId, children }: EnrichmentGateProps) {
    const router = useRouter();
    const hasNotifiedFailedRef = useRef(false);

    const isPending = status === "PENDING_LEI" || status === "PENDING_ENRICHMENT";
    const isError = status === "FAILED";

    // Poll for status updates only while waiting for GLEIF identity resolution
    useEffect(() => {
        if (status === "PENDING_LEI") {
            const timer = setInterval(() => {
                router.refresh();
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [status, router]);

    // Show a subtle toast once when enrichment failed
    useEffect(() => {
        if (isError && !hasNotifiedFailedRef.current) {
            hasNotifiedFailedRef.current = true;
            toast.info("Some registry data couldn't be retrieved. You can continue as normal.", {
                id: `enrichment-failed-${leId}`,
                duration: 6000
            });
        }
    }, [isError, leId]);

    return (
        <div className="w-full">
            {isPending && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50/80 border border-blue-200/60 text-blue-900 text-xs font-medium flex items-center justify-between shadow-sm transition-all">
                    <div className="flex items-center gap-2.5">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                        <span>
                            {status === "PENDING_LEI"
                                ? "Establishing entity identity from global databases…"
                                : "Retrieving registry data…"}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground text-[11px] font-mono">
                        {lei && <span>LEI: {lei}</span>}
                        {raId && <span>RA: {raId}</span>}
                    </div>
                </div>
            )}
            {children}
        </div>
    );
}

