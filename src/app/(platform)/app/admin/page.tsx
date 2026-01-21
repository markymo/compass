
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Building2, Database, Wand2, FileText, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default async function AdminDashboardPage() {
    // Fetch stats
    const [userCount, orgCount, draftQCount] = await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.questionnaire.count({ where: { status: "DRAFT" } })
    ]);

    const cards = [
        {
            title: "Organizations",
            description: "Manage Clients and Financial Institutions",
            href: "/app/admin/organizations",
            icon: Building2,
            color: "text-blue-500",
            stat: orgCount
        },
        {
            title: "Users",
            description: "Manage platform users and access roles",
            href: "/app/admin/users",
            icon: Users,
            color: "text-green-500",
            stat: userCount
        },
        {
            title: "Master Schema",
            description: "Define the core data dictionary",
            href: "/app/admin/schema",
            icon: Database,
            color: "text-purple-500",
        },
        {
            title: "AI Mapper",
            description: "Test and configure document mapping AI",
            href: "/app/admin/mapper",
            icon: Wand2,
            color: "text-amber-500",
        },
        {
            title: "Questionnaires",
            description: "Review and map uploaded FI forms",
            href: "/app/admin/questionnaires",
            icon: FileText,
            color: "text-pink-500",
            stat: draftQCount,
            badge: draftQCount > 0 ? "Pending Mapping" : null
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900 dark:text-slate-100">
                    System Administration
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
                    Manage the Compass platform core configuration and tenants.
                </p>
            </div>



            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/app/admin/todo" className="group">
                    <Card className="h-full border-blue-200 bg-blue-50/50 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 dark:border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base font-semibold text-blue-900 dark:text-slate-200">
                                Internal Tasks
                            </CardTitle>
                            <div className="rounded-full p-2.5 bg-white shadow-sm">
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                    Board
                                </div>
                            </div>
                            <CardDescription className="text-xs font-medium text-slate-500 line-clamp-2">
                                Manage "Stuff" and Backlog items
                            </CardDescription>
                        </CardContent>
                    </Card>
                </Link>

                {cards.map((card) => (
                    <Link key={card.title} href={card.href} className="group">
                        <Card className="h-full border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 dark:border-slate-800">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-200">
                                    {card.title}
                                </CardTitle>
                                <div className={`rounded-full p-2.5 ${card.color.replace('text-', 'bg-').replace('500', '100')} dark:bg-opacity-10`}>
                                    <card.icon className={`h-5 w-5 ${card.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {card.stat !== undefined ? card.stat : "-"}
                                    </div>
                                    {card.badge && (
                                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-100 animate-pulse">
                                            {card.badge}
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription className="text-xs font-medium text-slate-500 line-clamp-2">
                                    {card.description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-sm text-slate-500">
                    Platform metrics and system health monitoring coming soon.
                </p>
            </div>
        </div>

    );
}
