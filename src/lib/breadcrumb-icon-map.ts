import { 
    Link2, 
    Landmark, 
    Building2, 
    Home, 
    ClipboardList, 
    LucideIcon, 
    Sparkles, 
    Globe, 
    Database, 
    Users, 
    BookOpen, 
    CreditCard,
    Lock
} from "lucide-react";

export const BREADCRUMB_ICON_MAP: Record<string, LucideIcon> = {
    "link-2": Link2,
    "landmark": Landmark,
    "building-2": Building2,
    "home": Home,
    "clipboard-list": ClipboardList,
    "sparkles": Sparkles,
    "globe": Globe,
    "database": Database,
    "users": Users,
    "book-open": BookOpen,
    "credit-card": CreditCard,
    "lock": Lock
};

export function getBreadcrumbIcon(iconName?: string): LucideIcon | undefined {
    if (!iconName) return undefined;
    return BREADCRUMB_ICON_MAP[iconName];
}
