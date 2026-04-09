import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, LayoutGrid, ListTree, Settings2, ArrowUpDown, GitBranch, ListOrdered } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";

export default async function MasterDataAdminPage() {
    // We use try-catch or fallbacks because the Prisma client might still be lagging in types,
    // though the actual database has the tables.
    let fieldCount = 0;
    let groupCount = 0;

    try {
        [fieldCount, groupCount] = await Promise.all([
            (prisma as any).masterFieldDefinition.count(),
            (prisma as any).masterFieldGroup.count()
        ]);
    } catch (e) {
        console.error("Master Data tables not found yet?", e);
    }

    const stats = [
        { label: "Atomic Fields", value: fieldCount, icon: Database, color: "text-blue-600" },
        { label: "Virtual Groups", value: groupCount, icon: LayoutGrid, color: "text-purple-600" }
    ];

    const actions = [
        {
            title: "Field Glossary",
            description: "Manage atomic field definitions, active states, and documentation.",
            href: "/app/admin/master-data/fields",
            icon: ListTree,
            color: "text-blue-500"
        },
        {
            title: "Group Configurations",
            description: "Orchestrate virtual field groups and their child membership.",
            href: "/app/admin/master-data/groups",
            icon: LayoutGrid,
            color: "text-purple-500"
        },
        {
            title: "Schema Maintenance",
            description: "Run migrations, invalidate cache, and review system logs.",
            href: "/app/admin/master-data/system",
            icon: Settings2,
            color: "text-slate-500"
        },
        {
            title: "Taxonomy Order",
            description: "Configure display ordering for categories and fields.",
            href: "/app/admin/master-data/sort",
            icon: ArrowUpDown,
            color: "text-amber-500"
        },
        {
            title: "Source Mappings",
            description: "Configure how external data (GLEIF, registries) maps to master fields.",
            href: "/app/admin/master-data/source-mappings",
            icon: GitBranch,
            color: "text-green-500"
        },
        {
            title: "Option Sets",
            description: "Manage reusable dropdown data sources for Master Data fields.",
            href: "/app/admin/master-data/option-sets",
            icon: ListOrdered,
            color: "text-indigo-500"
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight font-serif text-slate-900 dark:text-slate-100">
                    Master Data Governance
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
                    Configure the authoritative schema used across all organizations and KYC workflows.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((s: any) => (
                    <Card key={s.label}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                            <s.icon className={`h-4 w-4 ${s.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{s.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {actions.map((action: any) => (
                    <Link key={action.title} href={action.href} className="group">
                        <Card className="h-full border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 dark:border-slate-800">
                            <CardHeader>
                                <div className={`mb-4 w-fit rounded-lg p-3 ${action.color.replace('text-', 'bg-').replace('500', '100')} dark:bg-opacity-10`}>
                                    <action.icon className={`h-6 w-6 ${action.color}`} />
                                </div>
                                <CardTitle>{action.title}</CardTitle>
                                <CardDescription>{action.description}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
