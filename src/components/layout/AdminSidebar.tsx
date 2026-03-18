"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    ShieldCheck, Building2, Users, Wand2, FileText,
    UserCheck, MessageSquarePlus, Database, Activity,
    ListTree, LayoutGrid, Settings2, ArrowUpDown, GitBranch,
    ChevronDown
} from "lucide-react";
import { useState } from "react";

interface NavItem {
    title: string;
    href: string;
    icon: any;
    children?: NavItem[];
}

const adminNavItems: NavItem[] = [
    { title: "Dashboard", href: "/app/admin", icon: ShieldCheck },
    { title: "Organizations", href: "/app/admin/organizations", icon: Building2 },
    { title: "Users", href: "/app/admin/users", icon: Users },
    { title: "AI Mapper", href: "/app/admin/mapper", icon: Wand2 },
    { title: "Questionnaires", href: "/app/admin/questionnaires", icon: FileText },
    { title: "Demo Room", href: "/app/admin/demo", icon: UserCheck },
    { title: "Feedback", href: "/app/admin/feedback", icon: MessageSquarePlus },
    {
        title: "Master Data",
        href: "/app/admin/master-data",
        icon: Database,
        children: [
            { title: "Field Glossary", href: "/app/admin/master-data/fields", icon: ListTree },
            { title: "Groups", href: "/app/admin/master-data/groups", icon: LayoutGrid },
            { title: "Taxonomy Order", href: "/app/admin/master-data/sort", icon: ArrowUpDown },
            { title: "System", href: "/app/admin/master-data/system", icon: Settings2 },
            { title: "Source Mappings", href: "/app/admin/master-data/source-mappings", icon: GitBranch },
        ]
    },
    { title: "Pulse", href: "/app/admin/pulse", icon: Activity },
];

function isActive(pathname: string, href: string): boolean {
    if (href === "/app/admin") return pathname === "/app/admin";
    return pathname.startsWith(href);
}

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
    const pathname = usePathname();
    const active = isActive(pathname, item.href);
    const hasChildren = item.children && item.children.length > 0;
    const childActive = hasChildren && item.children!.some(c => isActive(pathname, c.href));
    const [expanded, setExpanded] = useState(active || childActive);

    const Icon = item.icon;

    if (hasChildren) {
        return (
            <div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        (active || childActive)
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50",
                    )}
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{item.title}</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
                        <Link
                            href={item.href}
                            className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                active && !childActive
                                    ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800/50"
                            )}
                        >
                            Overview
                        </Link>
                        {item.children!.map(child => (
                            <NavLink key={child.href} item={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                depth > 0 ? "py-1.5 gap-2.5 text-xs" : "py-2",
                active
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50",
            )}
        >
            <Icon className={cn("shrink-0", depth > 0 ? "h-3.5 w-3.5" : "h-4 w-4")} />
            <span>{item.title}</span>
        </Link>
    );
}

export function AdminSidebar() {
    return (
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-zinc-900">
            <div className="sticky top-20 flex flex-col gap-1 p-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
                <div className="mb-3 flex items-center gap-2 px-3">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Admin</span>
                </div>
                <nav className="space-y-0.5">
                    {adminNavItems.map(item => (
                        <NavLink key={item.href} item={item} />
                    ))}
                </nav>
            </div>
        </aside>
    );
}
