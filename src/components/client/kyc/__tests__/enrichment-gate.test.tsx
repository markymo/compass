// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EnrichmentGate } from "../enrichment-gate";
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: vi.fn(),
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        info: vi.fn(),
    },
}));

describe("EnrichmentGate UX Behavior", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("renders children immediately and shows subtle indicator during PENDING_LEI", () => {
        render(
            <EnrichmentGate leId="le-123" status="PENDING_LEI" lei="5493001KJTIIGC8Y1R12" raId="RA000585">
                <div data-testid="master-page-content">Master Data Content</div>
            </EnrichmentGate>
        );

        // Children visible and usable
        expect(screen.getByTestId("master-page-content")).toBeDefined();
        // Compact pending banner visible
        expect(screen.getByText("Establishing entity identity from global databases…")).toBeDefined();
        expect(screen.getByText("LEI: 5493001KJTIIGC8Y1R12")).toBeDefined();
        expect(screen.getByText("RA: RA000585")).toBeDefined();
        // Toast not shown for pending state
        expect(toast.info).not.toHaveBeenCalled();
    });

    it("renders children immediately and shows subtle indicator during PENDING_ENRICHMENT", () => {
        render(
            <EnrichmentGate leId="le-123" status="PENDING_ENRICHMENT" lei="5493001KJTIIGC8Y1R12">
                <div data-testid="master-page-content">Master Data Content</div>
            </EnrichmentGate>
        );

        expect(screen.getByTestId("master-page-content")).toBeDefined();
        expect(screen.getByText("Retrieving registry data…")).toBeDefined();
        expect(toast.info).not.toHaveBeenCalled();
    });

    it("renders children immediately with no blocking modal and fires subtle toast ONCE on FAILED", () => {
        const { rerender } = render(
            <EnrichmentGate leId="le-123" status="FAILED">
                <div data-testid="master-page-content">Master Data Content</div>
            </EnrichmentGate>
        );

        // Children visible immediately
        expect(screen.getByTestId("master-page-content")).toBeDefined();

        // Blocking card text and "Proceed Manually" button must NOT be present
        expect(screen.queryByText("Enrichment Failed")).toBeNull();
        expect(screen.queryByText("Proceed Manually")).toBeNull();
        expect(screen.queryByText("Locking Snapshot Workflow")).toBeNull();

        // Single neutral toast fired
        expect(toast.info).toHaveBeenCalledTimes(1);
        expect(toast.info).toHaveBeenCalledWith(
            "Some registry data couldn't be retrieved. You can continue as normal.",
            expect.objectContaining({ id: "enrichment-failed-le-123" })
        );

        // Re-rendering with same props does not spam toast
        rerender(
            <EnrichmentGate leId="le-123" status="FAILED">
                <div data-testid="master-page-content">Master Data Content</div>
            </EnrichmentGate>
        );
        expect(toast.info).toHaveBeenCalledTimes(1);
    });

    it("renders children seamlessly without banner or toast when status is ENRICHED", () => {
        render(
            <EnrichmentGate leId="le-123" status="ENRICHED">
                <div data-testid="master-page-content">Master Data Content</div>
            </EnrichmentGate>
        );

        expect(screen.getByTestId("master-page-content")).toBeDefined();
        expect(screen.queryByText("Retrieving registry data…")).toBeNull();
        expect(toast.info).not.toHaveBeenCalled();
    });
});
