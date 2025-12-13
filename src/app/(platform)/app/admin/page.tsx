
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Building2, Database, Wand2 } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
    const cards = [
        {
            title: "Organizations",
            description: "Manage Clients and Financial Institutions",
            href: "/app/admin/organizations",
            icon: Building2,
            color: "text-blue-500",
        },
        {
            title: "Users",
            description: "Manage platform users and access roles",
            href: "/app/admin/users",
            icon: Users,
            color: "text-green-500",
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
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
                <p className="text-muted-foreground">
                    Manage the Compass platform core configuration and tenants.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => (
                    <Link key={card.title} href={card.href}>
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {card.title}
                                </CardTitle>
                                <card.icon className={`h-4 w-4 ${card.color}`} />
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{card.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
