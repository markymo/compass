import { Home, LayoutDashboard, ClipboardCheck, User, Settings, Search, Shield } from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface BreadcrumbStaticConfig {
    label: string;
    href: string;
    icon?: LucideIcon;
}

export const STATIC_BREADCRUMBS: Record<string, BreadcrumbStaticConfig> = {
    "/app": {
        label: "Dashboard",
        href: "/app",
        icon: LayoutDashboard,
    },
    "/app/assignments": {
        label: "Assignments",
        href: "/app/assignments",
        icon: ClipboardCheck,
    },
    "/app/account": {
        label: "Account Settings",
        href: "/app/account",
        icon: User,
    },
    "/app/admin": {
        label: "System Admin",
        href: "/app/admin",
        icon: Shield,
    },
    "/app/scout": {
        label: "Scout",
        href: "/app/scout",
        icon: Search,
    },
    "/app/settings": {
        label: "Settings",
        href: "/app/settings",
        icon: Settings,
    }
};

export const HOME_BREADCRUMB: BreadcrumbStaticConfig = {
    label: "Home",
    href: "/app",
    icon: Home,
};
