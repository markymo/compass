"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, Search, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
 * Prevents users from editing the master snapshot until automated 
 * enrichment has completed. Provides visual feedback on the process.
 */
export function EnrichmentGate({ leId, status, lei, raId, children }: EnrichmentGateProps) {
    const [currentStatus, setCurrentStatus] = useState(status);
    const router = useRouter();

    const isPending = currentStatus === "PENDING_LEI" || currentStatus === "PENDING_ENRICHMENT";
    const isError = currentStatus === "FAILED";

    // In a real app, we might poll for status updates or use Pusher/Ably
    useEffect(() => {
        if (isPending) {
            const timer = setInterval(() => {
                router.refresh();
            }, 3000);
            return () => clearInterval(timer);
        }
    }, [isPending, router]);

    if (!isPending && !isError) {
        return <>{children}</>;
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
            <Card className="w-full max-w-2xl border-primary/20 shadow-xl overflow-hidden">
                <div className="h-2 bg-muted overflow-hidden">
                    {isPending && <Progress value={45} className="h-full animate-pulse transition-all duration-1000" />}
                </div>
                
                <CardHeader className="space-y-1 pb-8">
                    <div className="flex items-center gap-3 mb-2">
                        {currentStatus === "PENDING_LEI" ? (
                            <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                                <Globe className="w-5 h-5 animate-spin-slow" />
                            </div>
                        ) : (
                            <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                                <Database className="w-5 h-5 animate-bounce" />
                            </div>
                        )}
                        <CardTitle className="text-2xl font-bold tracking-tight">
                            {currentStatus === "PENDING_LEI" ? "Establishing Identity" : "Registry Enrichment in Progress"}
                        </CardTitle>
                    </div>
                    <CardDescription className="text-base text-muted-foreground">
                        {currentStatus === "PENDING_LEI" 
                            ? "We are resolving the Legal Entity Identifier (LEI) against global databases to determine the correct Registration Authority."
                            : "Fetching and mapping jurisdiction-specific data from the national registry. This ensures your snapshot starts with the most accurate information."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-8">
                    {/* Visual Steps */}
                    <div className="grid grid-cols-3 gap-4">
                        <StepItem 
                            icon={<Globe className="w-4 h-4" />} 
                            label="GLEIF Check" 
                            active={currentStatus === "PENDING_LEI"} 
                            complete={currentStatus !== "PENDING_LEI"} 
                        />
                        <StepItem 
                            icon={<Search className="w-4 h-4" />} 
                            label="Registry Fetch" 
                            active={currentStatus === "PENDING_ENRICHMENT"} 
                            complete={false} 
                        />
                        <StepItem 
                            icon={<CheckCircle2 className="w-4 h-4" />} 
                            label="Auto-Mapping" 
                            active={false} 
                            complete={false} 
                        />
                    </div>

                    {isError && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex gap-3 items-start">
                            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <h4 className="font-medium leading-none tracking-tight">Enrichment Failed</h4>
                                <p className="text-sm opacity-90">
                                    The automated process encountered an error. You may need to provide the LEI manually or proceed with manual data entry.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-4 py-4 border-y border-border/50 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground uppercase tracking-widest">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            Locking Snapshot Workflow
                        </div>
                        <p className="text-xs text-muted-foreground text-center px-8">
                            To ensure data integrity, the Master Data Schema is locked until initial provenance is established.
                        </p>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <div className="text-xs text-muted-foreground">
                            {lei && <span className="font-mono">LEI: {lei}</span>}
                            {raId && <span className="ml-4 font-mono">RA: {raId}</span>}
                        </div>
                        {isError && (
                            <Button variant="outline" onClick={() => setCurrentStatus("MANUAL")}>
                                Proceed Manually
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function StepItem({ icon, label, active, complete }: { icon: React.ReactNode, label: string, active: boolean, complete: boolean }) {
    return (
        <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-500 ${
            active ? "bg-primary/5 border-primary shadow-sm" : 
            complete ? "bg-green-50 border-green-200" : "bg-muted/20 border-transparent opacity-50"
        }`}>
            <div className={`p-2 rounded-full ${
                active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : 
                complete ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
            }`}>
                {complete ? <CheckCircle2 className="w-4 h-4" /> : icon}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                active ? "text-primary" : complete ? "text-green-700" : "text-muted-foreground"
            }`}>
                {label}
            </span>
        </div>
    );
}
