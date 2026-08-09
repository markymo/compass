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
    | "default";

export interface SectionAccentConfig {
    key: SectionAccentKey;
    label: string;
    navBorderClass: string;
    footerAccentClass: string;
}

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

    // LE & Nested Route Inheritance
    if (cleanPath.includes("/sources")) return SECTION_ACCENTS.sources;
    if (cleanPath.includes("/master")) return SECTION_ACCENTS.master;
    if (cleanPath.includes("/relationships") || cleanPath.includes("/engagement-new")) return SECTION_ACCENTS.relationships;
    if (cleanPath.includes("/workbench4") || cleanPath.includes("/questionnaire")) return SECTION_ACCENTS.questionBank;

    // Platform Modules
    if (cleanPath.includes("/assignments")) return SECTION_ACCENTS.assignments;
    if (cleanPath.startsWith("/app/s/") || cleanPath.includes("/supplier")) return SECTION_ACCENTS.supplier;
    if (cleanPath.startsWith("/app/admin")) return SECTION_ACCENTS.admin;

    return SECTION_ACCENTS.default;
}
