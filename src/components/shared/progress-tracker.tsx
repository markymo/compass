import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DashboardMetric } from "@/lib/dashboard-metrics";

interface ProgressTrackerProps {
    metrics: DashboardMetric;
    variant?: "row" | "header" | "card";
    className?: string;
    showDates?: boolean;
}

export function ProgressTracker({ metrics, variant = "row", className, showDates = true }: ProgressTrackerProps) {
    if (variant === "v2" as any) {
        return <V2HeaderVariant metrics={metrics} className={className} />;
    }

    if (variant === "header") {
        return <HeaderVariant metrics={metrics} className={className} />;
    }

    if (variant === "card") {
        return <CardVariant metrics={metrics} className={className} />;
    }

    return <RowVariant metrics={metrics} className={className} showDates={showDates} />;
}

// --- Variants ---

function RowVariant({ metrics, className, showDates }: { metrics: DashboardMetric, className?: string, showDates: boolean }) {
    return (
        <div className={cn("grid grid-cols-[repeat(6,80px)_auto] gap-0 items-center", className)}>
            <MetricCell value={metrics.total} />
            <MetricCell value={metrics.noData} />
            <MetricCell value={metrics.mapped} />
            <MetricCell value={metrics.answered} />
            <MetricCell value={metrics.approved} />
            <MetricCell value={metrics.released} />
        </div>
    );
}

function HeaderVariant({ metrics, className }: { metrics: DashboardMetric, className?: string }) {
    return (
        <div className={cn("flex w-full justify-between items-center px-4", className)}>
            <ScoutMetricItem label="Total" value={metrics.total} />
            <ScoutMetricItem label="No Data" value={metrics.noData} />
            <ScoutMetricItem label="Mapped" value={metrics.mapped} />
            <ScoutMetricItem label="Answered" value={metrics.answered} />
            <ScoutMetricItem label="Approved" value={metrics.approved} highlight={metrics.approved > 0} />
            <ScoutMetricItem label="Released" value={metrics.released} highlight={metrics.released > 0} />
        </div>
    );
}

function CardVariant({ metrics, className }: { metrics: DashboardMetric, className?: string }) {
    // Compact vertical or grid for cards
    return (
        <div className={cn("grid grid-cols-5 gap-2", className)}>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Tot</span>
                <span className="text-sm font-bold text-slate-600">{metrics.total}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Map</span>
                <span className="text-sm font-bold text-slate-600">{metrics.mapped}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Ans</span>
                <span className="text-sm font-bold text-amber-600">{metrics.answered}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Appr</span>
                <span className="text-sm font-bold text-emerald-600">{metrics.approved}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase">Sent</span>
                <span className="text-sm font-bold text-violet-600">{metrics.released}</span>
            </div>
        </div>
    );
}

// --- Atoms ---

function MetricCell({ value }: { value: number }) {
    return (
        <div className={cn(
            "text-right text-xs pr-2 font-mono w-[80px]",
            value === 0 ? "text-slate-300 dark:text-slate-700" : "text-slate-700 dark:text-slate-300 font-medium"
        )}>
            {value}
        </div>
    );
}

function ScoutMetricItem({ label, value, highlight }: { label: string, value: number, highlight?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{label}</span>
            <span className={cn(
                "text-xl font-mono font-medium",
                value === 0 ? "text-slate-300" : (highlight ? "text-slate-900" : "text-slate-600")
            )}>
                {value}
            </span>
        </div>
    );
}

function MicroChart({ value, total, colorClass, emptyClass, numeratorLabel, denominatorLabel }: { value: number, total: number, colorClass: string, emptyClass: string, numeratorLabel: string, denominatorLabel: string }) {
    if (total === 0) {
        return <div className="text-xs text-slate-300 h-full w-full flex items-center justify-center italic">No data</div>;
    }
    
    const percent = Math.min(100, Math.max(0, (value / total) * 100));
    
    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between items-baseline leading-none">
                <span className={cn("text-[10px] font-bold font-mono", percent > 0 ? colorClass : "text-slate-300")}>
                    {value}
                </span>
                <span className="text-[9px] text-slate-400 font-medium font-mono uppercase">
                    {(total - value)} {denominatorLabel}
                </span>
            </div>
            <div className={cn("h-1 w-full rounded-full overflow-hidden flex", emptyClass)}>
                <div className={cn("h-full transition-all duration-500")} style={{ width: `${percent}%`, backgroundColor: 'currentColor' }} />
            </div>
        </div>
    );
}

function V2HeaderVariant({ metrics, className }: { metrics: DashboardMetric, className?: string }) {
    return (
        <div className={cn("flex flex-wrap items-stretch gap-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden", className)}>
            {/* Total Section */}
            <div className="flex flex-col items-center justify-center px-6 py-3 bg-slate-50/50 border-r border-slate-100 min-w-[100px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Items</span>
                <span className="text-2xl font-black text-slate-900 font-mono leading-none">{metrics.total}</span>
            </div>

            {/* Sourcing Section */}
            <div className="flex-1 flex flex-col justify-center px-4 py-3 min-w-[140px] border-r border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Data Sourcing</span>
                <MicroChart 
                    value={metrics.mapped} 
                    total={metrics.total} 
                    colorClass="text-sky-600" 
                    emptyClass="bg-sky-50" 
                    numeratorLabel="Mapped" 
                    denominatorLabel="Gap" 
                />
            </div>

            {/* Completion Section */}
            <div className="flex-1 flex flex-col justify-center px-4 py-3 min-w-[140px] border-r border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Completion</span>
                <MicroChart 
                    value={metrics.answered} 
                    total={metrics.total} 
                    colorClass="text-amber-600" 
                    emptyClass="bg-amber-50" 
                    numeratorLabel="Answered" 
                    denominatorLabel="Blank" 
                />
            </div>

            {/* Sign-Off Section */}
            <div className="flex-1 flex flex-col justify-center px-4 py-3 min-w-[140px]">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sign-Off Status</span>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-indigo-500 uppercase leading-none mb-1">APPR</span>
                        <span className={cn("text-base font-bold font-mono leading-none", metrics.approved > 0 ? "text-indigo-600" : "text-slate-300")}>
                            {metrics.approved}
                        </span>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        <span className="text-[9px] font-bold text-emerald-500 uppercase leading-none mb-1">RLSD</span>
                        <span className={cn("text-base font-bold font-mono leading-none", metrics.released > 0 ? "text-emerald-600" : "text-slate-300")}>
                            {metrics.released}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
