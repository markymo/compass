import {
    LayoutDashboard,
    Database,
    Library,
    Layers,
    Clipboard,
    Sparkles,
    FileText,
    FolderOpen,
    Users,
    KanbanSquare,
    CreditCard,
    PackageCheck
} from "lucide-react";
import { NavItem } from "@/components/layout/HeaderNavList";

/**
 * Helper to check if a path matches exactly or is a sub-path
 */
const matchesPath = (current: string, target: string, exact = false) => {
    if (exact) return current === target || current === `${target}/`;
    return current.startsWith(target);
};

export const getLegalEntityTabs = (leId: string): NavItem[] => {
    const baseUrl = `/app/le/${leId}`;
    return [
        {
            label: "Overview",
            href: baseUrl,
            icon: LayoutDashboard,
            isActive: (path) => matchesPath(path, baseUrl, true)
        },
        {
            label: "Sources",
            href: `${baseUrl}/sources`,
            icon: Library,
            isActive: (path) => matchesPath(path, `${baseUrl}/sources`)
        },
        {
            label: "Master Record",
            href: `${baseUrl}/master`,
            icon: Database,
            isActive: (path) => matchesPath(path, `${baseUrl}/master`)
        },
        {
            label: "Questionnaires",
            href: `${baseUrl}/workbench4`,
            icon: Clipboard,
            isActive: (path) => matchesPath(path, `${baseUrl}/workbench4`)
        }
    ];
};

export const getRelationshipTabs = (leId: string, engagementId: string): NavItem[] => {
    const baseUrl = `/app/le/${leId}/engagement-new/${engagementId}`;
    
    // Helper for query param matching
    const matchesTab = (path: string, tabValue: string | null) => {
        // In a real app, you might use useSearchParams() in the component, 
        // but for this declarative config, we can check the window location or similar if needed.
        // However, since this is for the HeaderNavList which is a client component, 
        // we can pass the logic down.
        const url = new URL(path, 'http://localhost'); // Dummy domain for parsing
        const tab = url.searchParams.get('tab');
        return tab === tabValue || (tabValue === null && !tab);
    };

    return [
        {
            label: "Questionnaires",
            href: `${baseUrl}?tab=manage`,
            icon: FileText,
            isActive: (path) => matchesTab(path, "manage") || matchesTab(path, null) // Default tab
        },
        {
            label: "Documents",
            href: `${baseUrl}?tab=documents`,
            icon: FolderOpen,
            isActive: (path) => matchesTab(path, "documents")
        },
        {
            label: "Output Pack",
            href: `${baseUrl}?tab=output`,
            icon: PackageCheck,
            isActive: (path) => matchesTab(path, "output")
        },
        {
            label: "Team",
            href: `${baseUrl}?tab=team`,
            icon: Users,
            isActive: (path) => matchesTab(path, "team")
        }
    ];
};

export const getFIPortalTabs = (orgId: string): NavItem[] => {
    const baseUrl = `/app/s/${orgId}`;
    
    const matchesTab = (path: string, tabValue: string | null) => {
        const url = new URL(path, 'http://localhost');
        const tab = url.searchParams.get('tab');
        return tab === tabValue || (tabValue === null && !tab);
    };

    return [
        {
            label: "Overview",
            href: `${baseUrl}?tab=overview`,
            icon: LayoutDashboard,
            isActive: (path) => matchesTab(path, "overview") || matchesTab(path, null)
        },
        {
            label: "Workbench",
            href: `${baseUrl}?tab=workbench`,
            icon: KanbanSquare,
            isActive: (path) => matchesTab(path, "workbench")
        },
        {
            label: "Questionnaires",
            href: `${baseUrl}?tab=questionnaires`,
            icon: FileText,
            isActive: (path) => matchesTab(path, "questionnaires")
        },
        {
            label: "Team",
            href: `${baseUrl}?tab=team`,
            icon: Users,
            isActive: (path) => matchesTab(path, "team")
        }
    ];
};

export const getQuestionnaireTabs = (leId: string, engagementId: string, questionnaireId: string): NavItem[] => {
    const baseUrl = `/app/le/${leId}/engagement-new/${engagementId}/questionnaire/${questionnaireId}`;
    
    const matchesTab = (path: string, tabValue: string | null) => {
        const url = new URL(path, 'http://localhost');
        const tab = url.searchParams.get('tab');
        return tab === tabValue || (tabValue === null && !tab);
    };

    return [
        {
            label: "Questions",
            href: `${baseUrl}?tab=manage`,
            icon: FileText,
            isActive: (path) => matchesTab(path, "manage") || matchesTab(path, null)
        },
        {
            label: "Source & Processing",
            href: `${baseUrl}?tab=source`,
            icon: Sparkles,
            isActive: (path) => matchesTab(path, "source")
        }
    ];
};

export const getClientDashboardTabs = (clientId: string): NavItem[] => {
    const baseUrl = `/app/clients/${clientId}`;

    return [
        {
            label: "Overview",
            href: baseUrl,
            icon: LayoutDashboard,
            isActive: (path) => matchesPath(path, baseUrl, true)
        },
        {
            label: "Billing & Invoicing",
            href: `${baseUrl}/billing`,
            icon: CreditCard,
            isActive: (path) => matchesPath(path, `${baseUrl}/billing`)
        },
        {
            label: "Team",
            href: `${baseUrl}/team`,
            icon: Users,
            isActive: (path) => matchesPath(path, `${baseUrl}/team`)
        }
    ];
};
