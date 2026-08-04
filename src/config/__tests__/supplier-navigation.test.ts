import { describe, it, expect } from "vitest";
import { getFIPortalTabs } from "../navigation-tabs";
import { isNavItemActive } from "@/components/layout/HeaderNavList";

describe("Supplier Navigation & Route Migration", () => {
    const orgId = "test-supplier-123";
    const tabs = getFIPortalTabs(orgId);

    it("1. Supplier navigation contains Relationships, Questions & Answers, Admin, Teams", () => {
        const labels = tabs.map((t) => t.label);
        expect(labels).toEqual([
            "Relationships",
            "Questions & Answers",
            "Admin",
            "Teams",
        ]);
    });

    it("2. Settings tab is absent", () => {
        const labels = tabs.map((t) => t.label);
        expect(labels).not.toContain("Settings");
        expect(labels).not.toContain("Organisation Settings");
    });

    it("3. Teams has right-alignment (alignRight: true) and others are left-aligned", () => {
        const teamsTab = tabs.find((t) => t.label === "Teams")!;
        expect(teamsTab?.alignRight).toBe(true);

        const relTab = tabs.find((t) => t.label === "Relationships")!;
        const qaTab = tabs.find((t) => t.label === "Questions & Answers")!;
        const adminTab = tabs.find((t) => t.label === "Admin")!;

        expect(relTab?.alignRight).toBeFalsy();
        expect(qaTab?.alignRight).toBeFalsy();
        expect(adminTab?.alignRight).toBeFalsy();
    });

    it("4. Active navigation: Root route highlights Relationships", () => {
        const relTab = tabs.find((t) => t.label === "Relationships")!;
        const qaTab = tabs.find((t) => t.label === "Questions & Answers")!;

        expect(isNavItemActive(relTab, `/app/s/${orgId}`)).toBe(true);
        expect(isNavItemActive(relTab, `/app/s/${orgId}/`)).toBe(true);
        expect(isNavItemActive(qaTab, `/app/s/${orgId}`)).toBe(false);
    });

    it("4 & 8. Active navigation: Relationship detail and workbench deep links keep Relationships active", () => {
        const relTab = tabs.find((t) => t.label === "Relationships")!;
        const qaTab = tabs.find((t) => t.label === "Questions & Answers")!;
        const adminTab = tabs.find((t) => t.label === "Admin")!;

        const engagementPath = `/app/s/${orgId}/engagements/eng-789`;
        const workbenchPath = `/app/s/${orgId}/engagements/eng-789/workbench/item-999`;

        expect(isNavItemActive(relTab, engagementPath)).toBe(true);
        expect(isNavItemActive(relTab, workbenchPath)).toBe(true);

        expect(isNavItemActive(qaTab, engagementPath)).toBe(false);
        expect(isNavItemActive(adminTab, engagementPath)).toBe(false);
    });

    it("4 & 8. Active navigation: Admin questionnaire detail deep links keep Admin active", () => {
        const adminTab = tabs.find((t) => t.label === "Admin")!;
        const relTab = tabs.find((t) => t.label === "Relationships")!;

        const qDetailPath = `/app/s/${orgId}/questionnaires/q-12345`;

        expect(isNavItemActive(adminTab, qDetailPath)).toBe(true);
        expect(isNavItemActive(relTab, qDetailPath)).toBe(false);
    });

    it("4. Active navigation: Questions & Answers route", () => {
        const qaTab = tabs.find((t) => t.label === "Questions & Answers")!;
        const relTab = tabs.find((t) => t.label === "Relationships")!;

        const questionsPath = `/app/s/${orgId}/questions`;

        expect(isNavItemActive(qaTab, questionsPath)).toBe(true);
        expect(isNavItemActive(relTab, questionsPath)).toBe(false);
    });

    it("4. Active navigation: Teams route", () => {
        const teamsTab = tabs.find((t) => t.label === "Teams")!;
        const relTab = tabs.find((t) => t.label === "Relationships")!;

        const teamPath = `/app/s/${orgId}/team`;

        expect(isNavItemActive(teamsTab, teamPath)).toBe(true);
        expect(isNavItemActive(relTab, teamPath)).toBe(false);
    });

    it("5 & 6. Legacy query strings: hrefs point to new clean paths instead of ?tab= query params", () => {
        const relTab = tabs.find((t) => t.label === "Relationships")!;
        const qaTab = tabs.find((t) => t.label === "Questions & Answers")!;
        const adminTab = tabs.find((t) => t.label === "Admin")!;
        const teamsTab = tabs.find((t) => t.label === "Teams")!;

        expect(relTab.href).toBe(`/app/s/${orgId}`);
        expect(qaTab.href).toBe(`/app/s/${orgId}/questions`);
        expect(adminTab.href).toBe(`/app/s/${orgId}/questionnaires`);
        expect(teamsTab.href).toBe(`/app/s/${orgId}/team`);
    });

    it("7. Supplier organisation scoping is preserved in base URL construction", () => {
        const customOrgId = "supplier-org-abc-999";
        const customTabs = getFIPortalTabs(customOrgId);

        expect(customTabs[0].href).toBe(`/app/s/${customOrgId}`);
        expect(customTabs[1].href).toBe(`/app/s/${customOrgId}/questions`);
        expect(customTabs[2].href).toBe(`/app/s/${customOrgId}/questionnaires`);
        expect(customTabs[3].href).toBe(`/app/s/${customOrgId}/team`);
    });
});
