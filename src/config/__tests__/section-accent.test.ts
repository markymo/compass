import { describe, it, expect } from "vitest";
import { resolveSectionAccent, HOME_FOOTER_ACCENT_COMPOSITION } from "../section-accent";

describe("Section Accent Resolution (Prototype E2)", () => {
    it("resolves Home multi-colour composition for /app and /app/dashboard-v2", () => {
        const appAccent = resolveSectionAccent("/app");
        expect(appAccent.key).toBe("home");
        expect(appAccent.footerComposition).toEqual(HOME_FOOTER_ACCENT_COMPOSITION);
        expect(appAccent.footerAccentClass).toBeUndefined();

        const dashboardV2Accent = resolveSectionAccent("/app/dashboard-v2");
        expect(dashboardV2Accent.key).toBe("home");
        expect(dashboardV2Accent.footerComposition).toEqual(HOME_FOOTER_ACCENT_COMPOSITION);
    });

    it("resolves single-colour footer accents for child sections", () => {
        const sources = resolveSectionAccent("/app/le/123/sources");
        expect(sources.key).toBe("sources");
        expect(sources.footerAccentClass).toBe("bg-sky-500");
        expect(sources.footerComposition).toBeUndefined();

        const master = resolveSectionAccent("/app/le/123/master");
        expect(master.key).toBe("master");
        expect(master.footerAccentClass).toBe("bg-orange-500");
        expect(master.footerComposition).toBeUndefined();

        const relationships = resolveSectionAccent("/app/relationships");
        expect(relationships.key).toBe("relationships");
        expect(relationships.footerAccentClass).toBe("bg-purple-600");
        expect(relationships.footerComposition).toBeUndefined();

        const questionBank = resolveSectionAccent("/app/le/123/workbench4");
        expect(questionBank.key).toBe("questionBank");
        expect(questionBank.footerAccentClass).toBe("bg-indigo-600");
        expect(questionBank.footerComposition).toBeUndefined();

        const assignments = resolveSectionAccent("/app/assignments");
        expect(assignments.key).toBe("assignments");
        expect(assignments.footerAccentClass).toBe("bg-rose-600");
        expect(assignments.footerComposition).toBeUndefined();

        const supplier = resolveSectionAccent("/app/s/org-123");
        expect(supplier.key).toBe("supplier");
        expect(supplier.footerAccentClass).toBe("bg-emerald-600");
        expect(supplier.footerComposition).toBeUndefined();

        const admin = resolveSectionAccent("/app/admin");
        expect(admin.key).toBe("admin");
        expect(admin.footerAccentClass).toBe("bg-slate-900 dark:bg-slate-100");
        expect(admin.footerComposition).toBeUndefined();
    });

    it("ensures Home footer composition contains only approved character colors and sums to 100%", () => {
        const totalWidth = HOME_FOOTER_ACCENT_COMPOSITION.reduce((sum, seg) => sum + seg.widthPercent, 0);
        expect(totalWidth).toBe(100);

        const classes = HOME_FOOTER_ACCENT_COMPOSITION.map(s => s.colorClass);
        expect(classes).toEqual([
            "bg-sky-500",      // Sources (Blue)
            "bg-orange-500",   // Master Record (Orange)
            "bg-purple-600",   // Relationships (Purple)
            "bg-indigo-600",   // Question Bank (Indigo)
            "bg-rose-600",     // Assignments (Rose)
            "bg-emerald-600",  // Supplier Portal (Emerald)
        ]);
    });
});
