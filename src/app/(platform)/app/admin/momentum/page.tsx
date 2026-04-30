import React from "react";
import { 
    Zap, 
    Target, 
    LayoutDashboard, 
    ListTodo, 
    BarChart3,
    ArrowUpRight,
    Search
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMomentumReadiness } from "@/actions/momentum";

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
                {/* Next Best Action Placeholder */}
                <Card className="lg:col-span-2 border-indigo-100 bg-indigo-50/20 border-dashed">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-indigo-600 mb-1">
                            <Target className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Next Best Action</span>
                        </div>
                        <CardTitle>Identifying Priority Task...</CardTitle>
                        <CardDescription>
                            The engine is scanning for high-impact gaps in your master schema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-24 flex items-center justify-center text-slate-400 italic text-sm">
                        NBA Logic Pending implementation in Slice 6
                    </CardContent>
                </Card>

                {/* Nearly Complete Categories Placeholder */}
                <Card className="border-dashed">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                            <ArrowUpRight className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Nearly Complete</span>
                        </div>
                        <CardTitle>Quick Wins</CardTitle>
                    </CardHeader>
                    <CardContent className="h-24 flex items-center justify-center text-slate-400 italic text-sm text-center">
                        Categories near 100% completion will appear here.
                    </CardContent>
                </Card>
            </div>

            {/* Category Readiness Board Placeholder */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-800">Category Readiness</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="border-dashed h-40 flex items-center justify-center text-slate-400 italic text-sm">
                            Category Card {i} Placeholder
                        </Card>
                    ))}
                </div>
            </div>

            {/* Field Completion Queue Placeholder */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ListTodo className="h-5 w-5 text-slate-400" />
                        <h2 className="text-lg font-semibold text-slate-800">Field Completion Queue</h2>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                            disabled 
                            className="pl-9 h-9 w-64 rounded-md border border-slate-200 bg-slate-50 text-sm italic"
                            placeholder="Search queue (disabled)..."
                        />
                    </div>
                </div>
                <div className="border rounded-lg border-dashed h-64 flex items-center justify-center text-slate-400 italic text-sm bg-slate-50/30">
                    Completion Queue Table Placeholder
                </div>
            </div>
        </div>
    );
}
