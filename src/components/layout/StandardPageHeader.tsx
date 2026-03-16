import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LucideIcon, ChevronRight, Home } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface BreadcrumbItemData {
    label: string;
    href?: string;
    icon?: LucideIcon;
}

interface StandardPageHeaderProps {
    title?: string | React.ReactNode;
    subtitle?: string;
    typeLabel?: string;
    breadcrumbs: BreadcrumbItemData[];
    actions?: React.ReactNode;
    secondaryNav?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    sticky?: boolean;
}

export function StandardPageHeader({
    title,
    subtitle,
    typeLabel,
    breadcrumbs,
    actions,
    secondaryNav,
    children,
    className,
    sticky = true
}: StandardPageHeaderProps) {
    // If title is not provided, we might want to hide the title row or use the last breadcrumb as title
    // But for now, let's just make the title row conditional.
    
    return (
        <div className={cn(
            "contents",
            className
        )}>
            {/* Breadcrumb Row - Sticky at top-20 */}
            <div className={cn(
                "flex h-12 items-center px-4 md:px-8 border-b border-slate-100 dark:border-zinc-800/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/95 transition-all w-full z-50",
                sticky && "sticky top-20"
            )}>
                <Breadcrumb className="whitespace-nowrap overflow-x-auto no-scrollbar">
                    <BreadcrumbList className="flex-nowrap">
                        {breadcrumbs.map((item, index) => {
                            const isLast = index === breadcrumbs.length - 1;
                            const Icon = item.icon;

                            return (
                                <React.Fragment key={index}>
                                    <BreadcrumbItem>
                                        {isLast ? (
                                            <BreadcrumbPage className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                                                {Icon && <Icon className="h-3.5 w-3.5" />}
                                                {item.label}
                                            </BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink
                                                asChild
                                                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors"
                                            >
                                                <Link href={item.href || "#"}>
                                                    {Icon && <Icon className="h-3.5 w-3.5" />}
                                                    {item.label}
                                                </Link>
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                    {!isLast && <BreadcrumbSeparator className="text-slate-300 dark:text-zinc-700" />}
                                </React.Fragment>
                            );
                        })}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            {/* Content Area - Scrolls away (bg-white ensures it goes 'under' the sticky crumbs) */}
            <div className="bg-white dark:bg-zinc-950">
                {/* Title Row - Only render if title or actions exist */}
                {(title || actions) && (
                    <div className="flex items-center justify-between px-4 py-4 md:px-8">
                        <div className="flex flex-col gap-1.5 min-w-0">
                            {typeLabel && (
                                <span className="w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 shrink-0 mb-1">
                                    {typeLabel}
                                </span>
                            )}
                            <div className="flex items-center gap-3 min-w-0">
                                {title && (
                                    typeof title === "string" ? (
                                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                                            {title}
                                        </h1>
                                    ) : (
                                        title
                                    )
                                )}
                            </div>
                            {subtitle && (
                                <p className="text-sm text-muted-foreground truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>

                        {actions && (
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                {actions}
                            </div>
                        )}
                    </div>
                )}

                {/* Extra Content Area (Optional) */}
                {children && (
                    <div className="px-4 md:px-8 pb-4">
                        {children}
                    </div>
                )}
            </div>

            {/* Secondary Navigation Row (Tabs) - Sticky below Breadcrumbs */}
            {secondaryNav && (
                <div className={cn(
                    "px-4 md:px-8 border-b border-transparent bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/95 transition-all w-full z-40",
                    sticky && "sticky top-[calc(5rem+3rem)] border-slate-100 dark:border-zinc-800/50 shadow-sm"
                )}>
                    {secondaryNav}
                </div>
            )}
        </div>
    );
}
