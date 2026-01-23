import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LucideIcon, ChevronRight } from "lucide-react";
import React from "react";

export interface GuideBreadcrumbItem {
    label: string;
    href?: string; // If undefined, it's the current page
    icon?: LucideIcon;
}

interface GuideHeaderProps {
    breadcrumbs: GuideBreadcrumbItem[];
    actions?: React.ReactNode;
    className?: string;
}

export function GuideHeader({ breadcrumbs, actions, className = "" }: GuideHeaderProps) {
    return (
        <div className={`sticky top-20 z-40 flex h-14 items-center justify-between border-b bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/95 md:px-6 ${className}`}>
            <Breadcrumb>
                <BreadcrumbList>
                    {breadcrumbs.map((item, index) => {
                        const isLast = index === breadcrumbs.length - 1;
                        const Icon = item.icon;

                        return (
                            <React.Fragment key={index}>
                                <BreadcrumbItem>
                                    {isLast ? (
                                        <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {item.label}
                                        </BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink
                                            href={item.href}
                                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {item.label}
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                                {!isLast && <BreadcrumbSeparator />}
                            </React.Fragment>
                        );
                    })}
                </BreadcrumbList>
            </Breadcrumb>

            {actions && (
                <div className="flex items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}
