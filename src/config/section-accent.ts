/**
 * OnPro Section Accent Architecture
 * 
 * Single authoritative source of truth mapping section identity to section character accents.
 * 
 * Core Design Principle:
 * "Colour should punctuate the interface, not occupy it."
 * 
 * Approved Structural Accent Placements:
 * 1. Active navigation bottom underline — 2px
 * 2. Full-width line attached to top edge of footer — 3px
 */

export type SectionAccentKey =
    | "sources"
    | "master"
    | "relationships"
    | "questionBank"
    | "assignments"
    | "supplier"
    | "admin"
    | "home"
    | "default";

export interface FooterAccentSegment {
    label: string;
    colorClass: string;
    widthPercent: number;
}

export interface SectionAccentConfig {
    key: SectionAccentKey;
    label: string;
    navBorderClass: string;
    footerAccentClass?: string;
    footerComposition?: FooterAccentSegment[];
}

/**
 * Prototype E2: Home Multi-Colour Accent Composition
 * Editorial asymmetric distribution of established OnPro section character accents:
 * - Sources (Sky / Blue): 24%
 * - Master Record (Orange): 20%
 * - Relationships (Purple): 22%
 * - Question Bank (Indigo): 18%
 * - Assignments (Rose): 8%
 * - Supplier Portal (Emerald): 8%
 */
export const HOME_FOOTER_ACCENT_COMPOSITION: FooterAccentSegment[] = [
    { label: "Sources", colorClass: "bg-sky-500", widthPercent: 24 },
    { label: "Master Record", colorClass: "bg-orange-500", widthPercent: 20 },
    { label: "Relationships", colorClass: "bg-purple-600", widthPercent: 22 },
    { label: "Question Bank", colorClass: "bg-indigo-600", widthPercent: 18 },
    { label: "Assignments", colorClass: "bg-rose-600", widthPercent: 8 },
    { label: "Supplier Portal", colorClass: "bg-emerald-600", widthPercent: 8 },
];

export const SECTION_ACCENTS: Record<SectionAccentKey, SectionAccentConfig> = {
    sources: {
        key: "sources",
        label: "Sources",
        navBorderClass: "border-sky-500",
        footerAccentClass: "bg-sky-500",
    },
    master: {
        key: "master",
        label: "Master Record",
        navBorderClass: "border-orange-500",
        footerAccentClass: "bg-orange-500",
    },
    relationships: {
        key: "relationships",
        label: "Relationships",
        navBorderClass: "border-purple-600",
        footerAccentClass: "bg-purple-600",
    },
    questionBank: {
        key: "questionBank",
        label: "Question Bank",
        navBorderClass: "border-indigo-600",
        footerAccentClass: "bg-indigo-600",
    },
    assignments: {
        key: "assignments",
        label: "Assignments",
        navBorderClass: "border-rose-600",
        footerAccentClass: "bg-rose-600",
    },
    supplier: {
        key: "supplier",
        label: "Supplier Portal",
        navBorderClass: "border-emerald-600",
        footerAccentClass: "bg-emerald-600",
    },
    admin: {
        key: "admin",
        label: "Admin",
        navBorderClass: "border-slate-900 dark:border-slate-100",
        footerAccentClass: "bg-slate-900 dark:bg-slate-100",
    },
    home: {
        key: "home",
        label: "Home",
        navBorderClass: "border-slate-900 dark:border-slate-100",
        footerComposition: HOME_FOOTER_ACCENT_COMPOSITION,
    },
    default: {
        key: "default",
        label: "Default Anchor",
        navBorderClass: "border-slate-900 dark:border-slate-100",
        footerAccentClass: "bg-slate-900 dark:bg-slate-100",
    },
};

/**
 * Resolves section accent configuration from pathname, explicit section key, or item href.
 * Cleanly handles parent-child route inheritance.
 */
export function resolveSectionAccent(pathname: string, explicitKey?: SectionAccentKey): SectionAccentConfig {
    if (explicitKey && SECTION_ACCENTS[explicitKey]) {
        return SECTION_ACCENTS[explicitKey];
    }

    const cleanPath = (pathname || "").split("?")[0].toLowerCase();

    // Home Overview Surfaces (/app & /app/dashboard-v2)
    if (cleanPath === "/app" || cleanPath === "/app/" || cleanPath === "/app/dashboard-v2" || cleanPath === "/app/dashboard-v2/") {
        return SECTION_ACCENTS.home;
    }

    // LE & Nested Route Inheritance
    if (cleanPath.includes("/sources")) return SECTION_ACCENTS.sources;
    if (cleanPath.includes("/master")) return SECTION_ACCENTS.master;
    if (cleanPath.includes("/relationships") || cleanPath.includes("/engagement-new")) return SECTION_ACCENTS.relationships;
    if (cleanPath.includes("/approvals")) return SECTION_ACCENTS.relationships;
    if (cleanPath.includes("/workbench4") || cleanPath.includes("/questionnaire")) return SECTION_ACCENTS.questionBank;

    // Platform Modules
    if (cleanPath.includes("/assignments")) return SECTION_ACCENTS.assignments;
    if (cleanPath.startsWith("/app/s/") || cleanPath.includes("/supplier")) return SECTION_ACCENTS.supplier;
    if (cleanPath.startsWith("/app/admin")) return SECTION_ACCENTS.admin;

    return SECTION_ACCENTS.default;
}

