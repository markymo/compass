"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";

export interface NavItem {
    label: string;
    href: string;
    icon?: LucideIcon;
    isActive: (pathname: string) => boolean;
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
                className="flex overflow-x-auto no-scrollbar py-0 space-x-8 mask-fade-right"
                aria-label="Secondary Navigation"
            >
                {items.map((item) => {
                    const active = item.isActive(fullPath);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "group inline-flex items-center gap-2.5 py-4 border-b-2 font-semibold text-sm transition-all duration-200 ease-in-out whitespace-nowrap shrink-0",
                                active
                                    ? "border-amber-500 text-blue-600 dark:text-blue-400"
                                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-zinc-500 dark:hover:text-zinc-100"
                            )}
                            aria-current={active ? "page" : undefined}
                        >
                            {Icon && (
                                <Icon className={cn(
                                    "h-4 w-4 transition-colors",
                                    active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:text-zinc-600 dark:group-hover:text-zinc-400"
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
