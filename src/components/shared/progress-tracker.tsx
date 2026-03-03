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
