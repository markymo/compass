"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    ShieldCheck, Building2, Users, Wand2, FileText,
    UserCheck, MessageSquarePlus, Database, Activity,
    ListTree, LayoutGrid, Settings2, ArrowUpDown, GitBranch,
    ChevronDown, Zap, ListOrdered
} from "lucide-react";
import { useState } from "react";

interface NavItem {
    title: string;
    href: string;
    icon: any;
    children?: NavItem[];
}

const adminNavItems: NavItem[] = [
    { title: "Pulse", href: "/app/admin/pulse", icon: Activity },
    { title: "Organizations", href: "/app/admin/organizations", icon: Building2 },
    { title: "Users", href: "/app/admin/users", icon: Users },
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
            { title: "Taxonomy Sorting", href: "/app/admin/master-data/sort", icon: ArrowUpDown },
            { title: "System", href: "/app/admin/master-data/system", icon: Settings2 },
            { title: "Source Mappings", href: "/app/admin/master-data/source-mappings", icon: GitBranch },
            { title: "Option Sets", href: "/app/admin/master-data/option-sets", icon: ListOrdered },
        ]
    },
    { title: "Dashboard (old)", href: "/app/admin", icon: ShieldCheck },
];

const rddShortcutItems: NavItem[] = [
    { title: "Field Glossary", href: "/app/admin/master-data/fields", icon: ListTree },
    { title: "Source Mappings", href: "/app/admin/master-data/source-mappings", icon: GitBranch },
    { title: "Taxonomy Sorting", href: "/app/admin/master-data/sort", icon: ArrowUpDown },
    { title: "Option Sets", href: "/app/admin/master-data/option-sets", icon: ListOrdered },
];

function isActive(pathname: string, href: string): boolean {
    if (href === "/app/admin") return pathname === "/app/admin";
    return pathname.startsWith(href);
}

function NavLink({ item, depth = 0, isCollapsed = false }: { item: NavItem; depth?: number; isCollapsed?: boolean }) {
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
                        "flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors",
                        isCollapsed ? "justify-center px-0" : "gap-3 px-3",
                        (active || childActive)
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50",
                    )}
                    title={isCollapsed ? item.title : undefined}
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span className="flex-1 text-left line-clamp-1">{item.title}</span>}
                    {!isCollapsed && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />}
                </button>
                {expanded && !isCollapsed && (
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
                            <NavLink key={child.href} item={child} depth={depth + 1} isCollapsed={false} />
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
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                isCollapsed ? "justify-center py-2 px-0" : cn("px-3", depth > 0 ? "py-1.5 gap-2.5 text-xs" : "py-2 gap-3"),
                active
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50",
            )}
            title={isCollapsed ? item.title : undefined}
        >
            <Icon className={cn("shrink-0", (!isCollapsed && depth > 0) ? "h-3.5 w-3.5" : "h-4 w-4")} />
            {!isCollapsed && <span>{item.title}</span>}
        </Link>
    );
}

export function AdminSidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside 
            className="shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-zinc-900 transition-all duration-300 overflow-x-hidden"
            style={{ 
                width: isCollapsed ? '64px' : '224px',
                minWidth: isCollapsed ? '64px' : '224px',
                maxWidth: isCollapsed ? '64px' : '224px'
            }}
        >
            <div className="sticky top-20 flex flex-col gap-1 p-4 max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-hidden" style={{ width: isCollapsed ? '64px' : '224px' }}>
                {/* Header row with Admin label + collapse toggle */}
                <div className={cn("mb-3 flex items-center gap-2", isCollapsed ? "justify-center" : "justify-between px-3")}>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                        {!isCollapsed && <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Admin</span>}
                    </div>
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform duration-300", isCollapsed ? "rotate-180" : "")}>
                            <path d="m15 18-6-6 6-6"/>
                        </svg>
                    </button>
                </div>
                <nav className="space-y-0.5">
                    {adminNavItems.map(item => (
                        <NavLink key={item.href} item={item} isCollapsed={isCollapsed} />
                    ))}
                </nav>

                <div className={cn("mt-6 mb-2 flex items-center gap-2 pt-6 border-t border-slate-200 dark:border-slate-800", isCollapsed ? "justify-center" : "px-3")}>
                    <Zap className="h-4 w-4 text-indigo-500 fill-indigo-500/20 shrink-0" />
                    {!isCollapsed && <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">RDD&apos;s Shortcuts</span>}
                </div>
                <nav className="space-y-0.5">
                    {rddShortcutItems.map(item => (
                        <NavLink key={"short-" + item.href} item={item} isCollapsed={isCollapsed} />
                    ))}
                </nav>
            </div>
        </aside>
    );
}
