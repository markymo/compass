import { Link2, Briefcase, Building2, Home, LucideIcon } from "lucide-react";

export const BREADCRUMB_ICON_MAP: Record<string, LucideIcon> = {
    "link-2": Link2,
    "briefcase": Briefcase,
    "building-2": Building2,
    "home": Home
};

export function getBreadcrumbIcon(iconName?: string): LucideIcon | undefined {
    if (!iconName) return undefined;
    return BREADCRUMB_ICON_MAP[iconName];
}
