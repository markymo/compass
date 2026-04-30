import { 
    Zap, 
    Target, 
    LayoutDashboard, 
    ListTodo, 
    BarChart3,
    ArrowUpRight,
    Search,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getMomentumReadiness } from "@/actions/momentum";
import { ReadinessQueue } from "@/components/client/admin/momentum/readiness-queue";

/**
 * Momentum Page Shell (Slice 1 - Read Only Shell)
 * Maintain progress across field completion, source mapping, and system readiness.
 */
export default async function MomentumPage() {
    const data = await getMomentumReadiness();

    const stats = [
        {
            title: "Active Fields",
            value: data.totalFields,
            description: "Total master fields",
            icon: ListTodo,
            color: "text-slate-600",
            percentage: null
        },
        {
            title: "Valid Descriptions",
            value: data.describedFields,
            description: "Semantic clarity",
            icon: BarChart3,
            color: "text-blue-600",
            percentage: data.totalFields > 0 ? (data.describedFields / data.totalFields) * 100 : 0
        },
        {
            title: "UK CH Mappings",
            value: data.ukMappedFields,
            description: "Structural connectivity",
            icon: ArrowUpRight,
            color: "text-amber-600",
            percentage: data.totalFields > 0 ? (data.ukMappedFields / data.totalFields) * 100 : 0
        },
        {
            title: "Fully Complete",
            value: data.fullyCompleteFields,
            description: "Ready for ingestion",
            icon: Zap,
            color: "text-emerald-600",
            percentage: data.totalFields > 0 ? (data.fullyCompleteFields / data.totalFields) * 100 : 0
        }
    ];

    return (
        <div className="space-y-8 w-full pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Zap className="h-6 w-6 text-indigo-600 fill-indigo-600/10" />
                        Momentum
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Maintain progress across field completion, source mapping, and system readiness.
                    </p>
                </div>
            </div>

            {/* Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="shadow-sm border-slate-200">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium text-slate-500">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">
                                    {stat.value}
                                </span>
                                {stat.percentage !== null && (
                                    <span className={`text-xs font-semibold ${stat.percentage >= 80 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                        {Math.round(stat.percentage)}%
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1 uppercase tracking-tight font-medium">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Next Best Action */}
                <Card className="lg:col-span-2 border-indigo-100 bg-indigo-50/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap className="h-32 w-32 text-indigo-600" />
                    </div>
                    <CardHeader>
                        <div className="flex items-center gap-2 text-indigo-600 mb-1">
                            <Target className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Next Best Action</span>
                        </div>
                        {data.nextBestAction ? (
                            <>
                                <CardTitle className="text-2xl font-serif">
                                    {data.nextBestAction.type === 'DESCRIPTION' ? 'Add description for' : 'Map UK source for'}{" "}
                                    <span className="text-indigo-600">
                                        {data.nextBestAction.fieldName}
                                    </span>
                                </CardTitle>
                                <CardDescription className="text-slate-600 font-medium max-w-lg">
                                    Continue the <span className="text-slate-900">{data.nextBestAction.categoryName}</span> category — {data.nextBestAction.actionsToComplete} {data.nextBestAction.actionsToComplete === 1 ? 'action' : 'actions'} to complete.
                                </CardDescription>
                            </>
                        ) : (
                            <>
                                <CardTitle>Schema Fully Ready</CardTitle>
                                <CardDescription>
                                    All active fields have valid descriptions and UK Companies House mappings.
                                </CardDescription>
                            </>
                        )}
                    </CardHeader>
                    {data.nextBestAction && (
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Field No.</span>
                                    <span className="text-sm font-mono font-bold text-slate-700">#{data.nextBestAction.fieldNo}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Category Progress</span>
                                    <span className="text-sm font-bold text-slate-700">
                                        {data.nextBestAction.fullyCompleteCount} / {data.nextBestAction.totalFields} fields ready
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Type</span>
                                    <Badge variant="secondary" className="text-[10px] bg-white border-indigo-100 text-indigo-700 h-5">
                                        {data.nextBestAction.type}
                                    </Badge>
                                </div>
                            </div>
                            
                            <div className="pt-2 flex items-center gap-3">
                                <button disabled className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold shadow-md opacity-50 cursor-not-allowed">
                                    Execute Action
                                </button>
                                <span className="text-[11px] text-slate-400 italic">
                                    Integration with FieldDetailSheet coming in later slices.
                                </span>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Nearly Complete Categories */}
                <Card className="shadow-sm border-emerald-100 bg-emerald-50/5 relative overflow-hidden">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                            <ArrowUpRight className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Nearly Complete</span>
                        </div>
                        <CardTitle className="text-lg">Quick Wins</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {data.categories
                            .filter(c => c.actionsToComplete > 0 && c.actionsToComplete <= 5)
                            .sort((a, b) => {
                                if (a.actionsToComplete !== b.actionsToComplete) return a.actionsToComplete - b.actionsToComplete;
                                const aPct = a.totalFields > 0 ? a.fullyCompleteCount / a.totalFields : 0;
                                const bPct = b.totalFields > 0 ? b.fullyCompleteCount / b.totalFields : 0;
                                return bPct - aPct;
                            })
                            .slice(0, 3)
                            .map((cat) => (
                                <div key={cat.id} className="p-2.5 rounded-lg border border-emerald-100 bg-white shadow-sm flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-800">{cat.displayName}</span>
                                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 border-emerald-200 bg-emerald-50">
                                            {cat.actionsToComplete} {cat.actionsToComplete === 1 ? 'action' : 'actions'} left
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-600">{cat.fullyCompleteCount}/{cat.totalFields}</span> Complete
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-600">{Math.round((cat.descriptionCount / cat.totalFields) * 100)}%</span> Desc
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-600">{Math.round((cat.ukMappingCount / cat.totalFields) * 100)}%</span> Map
                                        </div>
                                    </div>
                                </div>
                            ))}
                        {data.categories.filter(c => c.actionsToComplete > 0 && c.actionsToComplete <= 5).length === 0 && (
                            <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-sm italic text-center px-4">
                                <CheckCircle2 className="h-8 w-8 text-emerald-200 mb-2" />
                                No categories are within 5 actions of completion yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Category Readiness Board */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-800">Category Readiness</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.categories.map((cat) => {
                        const readinessPct = cat.totalFields > 0 ? (cat.fullyCompleteCount / cat.totalFields) * 100 : 0;
                        const descPct = cat.totalFields > 0 ? (cat.descriptionCount / cat.totalFields) * 100 : 0;
                        const mappingPct = cat.totalFields > 0 ? (cat.ukMappingCount / cat.totalFields) * 100 : 0;
                        const isUsable = mappingPct >= 100;

                        return (
                            <Card key={cat.id} className="shadow-sm border-slate-200 flex flex-col">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base font-bold text-slate-900">{cat.displayName}</CardTitle>
                                            <CardDescription>{cat.totalFields} fields in category</CardDescription>
                                        </div>
                                        {readinessPct === 100 ? (
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        ) : !isUsable && (
                                            <div title="Not yet fully usable for ingestion">
                                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 flex-1">
                                    {/* Main Readiness Bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs font-semibold">
                                            <span className="text-slate-600 uppercase tracking-tight">Fully Complete</span>
                                            <span className="text-slate-900">{Math.round(readinessPct)}%</span>
                                        </div>
                                        <Progress value={readinessPct} className="h-2 bg-slate-100" />
                                    </div>

                                    {/* Supporting Metrics */}
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Descriptions</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-semibold text-slate-700">{Math.round(descPct)}%</span>
                                                <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${descPct}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">UK Mapping</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-semibold text-slate-700">{Math.round(mappingPct)}%</span>
                                                <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-500" style={{ width: `${mappingPct}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Info */}
                                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between mt-auto">
                                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                            {isUsable ? (
                                                <span className="text-emerald-600 font-bold">READY FOR INGESTION</span>
                                            ) : (
                                                <span>{cat.actionsToComplete} ACTIONS TO COMPLETE</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-300">
                                            {cat.key}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Field Completion Queue */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-800">Field Completion Queue</h2>
                </div>
                
                <ReadinessQueue fields={data.fields} />
            </div>
        </div>
    );
}
