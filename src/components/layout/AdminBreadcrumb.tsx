"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
    ChevronRight, ArrowRight, ShieldCheck, Building2, Users, Wand2, FileText, 
    UserCheck, MessageSquarePlus, Database, Activity, ListTree, LayoutGrid, 
    Settings2, ArrowUpDown, GitBranch, ShieldPlus
} from "lucide-react";
import { cn } from "@/lib/utils";

const configMap: Record<string, { label: string; icon: any }> = {
    admin: { label: "Admin", icon: ShieldCheck },
    "master-data": { label: "Master Data", icon: Database },
    fields: { label: "Field Glossary", icon: ListTree },
    groups: { label: "Groups", icon: LayoutGrid },
    sort: { label: "Taxonomy Order", icon: ArrowUpDown },
    system: { label: "System", icon: Settings2 },
    "source-mappings": { label: "Source Mappings", icon: GitBranch },
    super: { label: "Super Admin", icon: ShieldPlus },
    organizations: { label: "Organizations", icon: Building2 },
    users: { label: "Users", icon: Users },
    mapper: { label: "AI Mapper", icon: Wand2 },
    questionnaires: { label: "Questionnaires", icon: FileText },
    demo: { label: "Demo Room", icon: UserCheck },
    feedback: { label: "Feedback", icon: MessageSquarePlus },
    pulse: { label: "Pulse", icon: Activity },
};

export function AdminBreadcrumb() {
    const pathname = usePathname();

    // Strip /app/admin prefix and split
    const relativePath = pathname.replace("/app/admin", "").replace(/^\//, "");
    if (!relativePath) return null; // On the dashboard itself, no breadcrumb needed

    const segments = relativePath.split("/").filter(Boolean);
    const crumbs = segments.map((seg, i) => {
        const config = configMap[seg];
        return {
            label: config?.label || seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            icon: config?.icon,
            href: "/app/admin/" + segments.slice(0, i + 1).join("/"),
            isLast: i === segments.length - 1,
        };
    });

    const AdminIcon = configMap.admin.icon;

    return (
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8 overflow-x-auto pb-1 whitespace-nowrap scrollbar-hide">
            <Link 
                href="/app/admin" 
                className="flex items-center gap-1.5 font-medium text-slate-600 hover:text-amber-600 transition-colors dark:text-slate-400 dark:hover:text-amber-400"
            >
                <AdminIcon className="h-4 w-4" />
                <span>Admin</span>
            </Link>

            {crumbs.map(crumb => (
                <div key={crumb.href} className="flex items-center gap-2">
                    <div className="flex items-center text-slate-400">
                        <div className="h-[1.5px] w-3 bg-slate-300" />
                        <ArrowRight className="h-4 w-4 -ml-1" />
                    </div>
                    
                    {crumb.isLast ? (
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                            {crumb.icon && <crumb.icon className="h-3.5 w-3.5 text-amber-600" />}
                            <span>{crumb.label}</span>
                        </div>
                    ) : (
                        <Link 
                            href={crumb.href} 
                            className="flex items-center gap-1.5 font-medium text-slate-600 hover:text-amber-600 transition-colors dark:text-slate-400 dark:hover:text-amber-400"
                        >
                            {crumb.icon && <crumb.icon className="h-3.5 w-3.5" />}
                            <span>{crumb.label}</span>
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    );
}

