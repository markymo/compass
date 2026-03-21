import { LucideIcon } from "lucide-react";
import React from "react";
import { StandardPageHeader, BreadcrumbItemData } from "./StandardPageHeader";

export interface GuideBreadcrumbItem {
    label: string;
    href?: string; // If undefined, it's the current page
    icon?: LucideIcon;
    iconName?: string;
}

interface GuideHeaderProps {
    breadcrumbs: GuideBreadcrumbItem[];
    actions?: React.ReactNode;
    typeLabel?: string;
    className?: string;
}

export function GuideHeader({ breadcrumbs, actions, typeLabel, className = "" }: GuideHeaderProps) {
    // Determine title: Use the label of the last breadcrumb
    const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    const title = lastBreadcrumb?.label || "";
    
    // Convert GuideBreadcrumbItem to BreadcrumbItemData
    const mappedBreadcrumbs: BreadcrumbItemData[] = breadcrumbs.map(item => ({
        label: item.label,
        href: item.href,
        icon: item.icon,
        iconName: item.iconName
    }));

    return (
        <StandardPageHeader
            title={title}
            typeLabel={typeLabel}
            breadcrumbs={mappedBreadcrumbs}
            actions={actions}
            className={className}
        />
    );
}
