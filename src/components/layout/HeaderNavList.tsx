"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";
import { getBreadcrumbIcon } from "@/lib/breadcrumb-icon-map";

export interface NavItem {
    label: string;
    href: string;
    icon?: LucideIcon;
    iconName?: string;
    isActive?: (pathname: string) => boolean;
    alignRight?: boolean;
    activeBorderClass?: string;
}

export function getActiveBorderClass(item: NavItem): string {
    if (item.activeBorderClass) return item.activeBorderClass;

    const labelLower = item.label.toLowerCase();
    const hrefLower = item.href.toLowerCase();

    if (labelLower.includes("source") || hrefLower.includes("/sources")) {
        return "border-sky-500";
    }
    if (labelLower.includes("master") || hrefLower.includes("/master")) {
        return "border-orange-500";
    }
    if (labelLower.includes("relationship") || hrefLower.includes("/relationships")) {
        return "border-purple-600";
    }
    if (labelLower.includes("question bank") || hrefLower.includes("/workbench4")) {
        return "border-indigo-600";
    }

    return "border-slate-900 dark:border-slate-100";
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
    if (item.isActive) {
        return item.isActive(pathname);
    }
    const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';
    const cleanHref = item.href.split('?')[0].replace(/\/$/, '') || '/';

    if (cleanPath === cleanHref) return true;

    const isSupplierRoot = /^\/app\/s\/[^\/]+$/.test(cleanHref);
    if (isSupplierRoot && cleanPath.startsWith(`${cleanHref}/engagements`)) {
        return true;
    }

    if (!isSupplierRoot && cleanHref !== '/' && cleanPath.startsWith(cleanHref)) {
        return true;
    }

    return false;
}

interface HeaderNavListProps {
    items: NavItem[];
}

export function HeaderNavList({ items }: HeaderNavListProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // Construct a full path with query string to pass to isActive for tab matching
    const fullPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    return (
        <div className="relative group/nav overflow-hidden">
            <nav
                className="flex w-full overflow-x-auto no-scrollbar py-0 space-x-8 mask-fade-right"
                aria-label="Secondary Navigation"
            >
                {items.map((item) => {
                    const active = isNavItemActive(item, fullPath);
                    const activeBorderClass = getActiveBorderClass(item);
                    const Icon = item.icon || (item.iconName ? getBreadcrumbIcon(item.iconName) : undefined);
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "group inline-flex items-center gap-2.5 py-4 border-b-2 font-semibold text-sm transition-all duration-200 ease-in-out whitespace-nowrap shrink-0",
                                active
                                    ? cn("text-slate-900 dark:text-slate-100", activeBorderClass)
                                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-zinc-500 dark:hover:text-zinc-100",
                                item.alignRight && "ml-auto"
                            )}
                            aria-current={active ? "page" : undefined}
                        >
                            {Icon && (
                                <Icon className={cn(
                                    "h-4 w-4 transition-colors",
                                    active ? "text-slate-700 dark:text-slate-300" : "text-slate-400 group-hover:text-slate-600 dark:text-zinc-600 dark:group-hover:text-zinc-400"
                                )} />
                            )}
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Fade background to indicate scroll availability on mobile */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent pointer-events-none md:hidden" />
        </div>
    );
}
