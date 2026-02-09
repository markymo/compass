
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Clock, AlertTriangle, CheckCircle2, Building2, UserPlus, FileText } from "lucide-react";

export function PortfolioSummary() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Relationships</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">
                        +2 from last month
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Onboardings</CardTitle>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">3</div>
                    <p className="text-xs text-muted-foreground">
                        In data collection phase
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Action Required</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">5</div>
                    <p className="text-xs text-muted-foreground">
                        Items pending your review
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">14d</div>
                    <p className="text-xs text-muted-foreground">
                        -2d improvement
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export function ActivityFeed() {
    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-8">
                    <div className="flex items-center">
                        <span className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full mr-4 bg-slate-100 items-center justify-center border border-slate-200">
                            <FileText className="h-4 w-4 text-slate-500" />
                        </span>
                        <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                                Acme Hedge Fund uploaded <span className="text-slate-500">'Annual Report 2024.pdf'</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                                2 minutes ago
                            </p>
                        </div>
                        <div className="ml-auto font-medium text-indigo-600 text-sm hover:underline cursor-pointer flex items-center gap-1">
                            Review <ArrowUpRight className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <span className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full mr-4 bg-slate-100 items-center justify-center border border-slate-200">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </span>
                        <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                                Global Infrastucture Partners completed 'KYC Questionnaire'
                            </p>
                            <p className="text-sm text-muted-foreground">
                                1 hour ago
                            </p>
                        </div>
                        <div className="ml-auto font-medium text-indigo-600 text-sm hover:underline cursor-pointer flex items-center gap-1">
                            View <ArrowUpRight className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <span className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full mr-4 bg-slate-100 items-center justify-center border border-slate-200">
                            <UserPlus className="h-4 w-4 text-blue-500" />
                        </span>
                        <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                                New onboarding started for Beta Solar SPV
                            </p>
                            <p className="text-sm text-muted-foreground">
                                4 hours ago
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
