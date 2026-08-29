"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";
import { getBreadcrumbIcon } from "@/lib/breadcrumb-icon-map";

import { resolveSectionAccent, SectionAccentKey } from "@/config/section-accent";

export interface NavItem {
    label: string;
    href: string;
    icon?: LucideIcon;
    iconName?: string;
    isActive?: (pathname: string) => boolean;
    alignRight?: boolean;
    activeBorderClass?: string;
    sectionAccentKey?: SectionAccentKey;
}

export function getActiveBorderClass(item: NavItem): string {
    if (item.activeBorderClass) return item.activeBorderClass;
    return resolveSectionAccent(item.href, item.sectionAccentKey).navBorderClass;
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

function HeaderNavListInner({ items }: HeaderNavListProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // Construct a full path with query string to pass to isActive for tab matching
    const fullPath = searchParams ? (searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname) : pathname;

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
                                    ? cn("text-foreground", activeBorderClass)
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                                item.alignRight && "ml-auto"
                            )}
                            aria-current={active ? "page" : undefined}
                        >
                            {Icon && (
                                <Icon className={cn(
                                    "h-4 w-4 transition-colors",
                                    active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                )} />
                            )}
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Fade background to indicate scroll availability on mobile */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none md:hidden" />
        </div>
    );
}

export function HeaderNavList(props: HeaderNavListProps) {
    return (
        <React.Suspense fallback={<div className="h-10" />}>
            <HeaderNavListInner {...props} />
        </React.Suspense>
    );
}
