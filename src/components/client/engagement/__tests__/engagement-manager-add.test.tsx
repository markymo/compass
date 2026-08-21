/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import React from "react";
import { EngagementManager } from "../engagement-manager";
import { searchFIs } from "@/actions/client";
import { createFIEngagement } from "@/actions/client-le";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/actions/client", () => ({
    searchFIs: vi.fn(),
    deleteEngagementByClient: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/actions/client-le", () => ({
    createFIEngagement: vi.fn().mockResolvedValue({
        success: true,
        actionType: "CREATED",
        engagement: { id: "eng-new", fiOrgId: "barclays-id", org: { id: "barclays-id", name: "Barclays Bank PLC" } },
    }),
}));

vi.mock("@/actions/questionnaire", () => ({
    assignQuestionnaireToEngagement: vi.fn(),
    deleteQuestionnaire: vi.fn(),
}));

vi.mock("@/actions/questionnaires-v2", () => ({
    getDiscoverableReferenceSnapshotsForOrg: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/providers/user-preferences-provider", () => ({
    usePreferences: () => ({
        preferences: {},
        isLoading: false,
        updatePreference: vi.fn(),
    }),
}));

describe("EngagementManager + Add Supplier Relationship Search-First Flow", () => {
    const mockLeId = "le-123";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("1. Opening '+ Add' shows no candidate organisations initially and does NOT render 'Available Institutions' or hardcoded banks", async () => {
        render(
            <EngagementManager
                leId={mockLeId}
                initialEngagements={[]}
                leDueDate={null}
            />
        );

        const addButton = screen.getByTitle("Add Supplier Relationship");
        fireEvent.click(addButton);

        expect(await screen.findByText("Add Supplier Relationship")).toBeTruthy();
        expect(screen.getByPlaceholderText("Search financial institutions...")).toBeTruthy();
        expect(screen.queryByText("Available Institutions")).toBeNull();
        expect(screen.queryByText("J.P. Morgan")).toBeNull();
        expect(screen.getByText("Type an institution name to search matching organizations.")).toBeTruthy();
    });

    it("2. Entering a search term causes matching results to appear", async () => {
        (searchFIs as any).mockResolvedValueOnce([
            { value: "barclays-id", label: "Barclays Bank PLC", description: "Global Investment Bank" },
        ]);

        render(
            <EngagementManager
                leId={mockLeId}
                initialEngagements={[]}
                leDueDate={null}
            />
        );

        fireEvent.click(screen.getByTitle("Add Supplier Relationship"));
        const searchInput = screen.getByPlaceholderText("Search financial institutions...");

        fireEvent.change(searchInput, { target: { value: "Barclays" } });
        expect(searchFIs).toHaveBeenCalledWith("Barclays");

        await waitFor(() => {
            expect(screen.getByText("Barclays Bank PLC")).toBeTruthy();
            expect(screen.getByText("Global Investment Bank")).toBeTruthy();
        });
        expect(screen.queryByText("Available Institutions")).toBeNull();
    });

    it("3. Clearing the search term returns to zero state with no candidate organisations visible", async () => {
        (searchFIs as any).mockResolvedValueOnce([
            { value: "hsbc-id", label: "HSBC UK", description: "Commercial Banking" },
        ]);

        render(
            <EngagementManager
                leId={mockLeId}
                initialEngagements={[]}
                leDueDate={null}
            />
        );

        fireEvent.click(screen.getByTitle("Add Supplier Relationship"));
        const searchInput = screen.getByPlaceholderText("Search financial institutions...");

        fireEvent.change(searchInput, { target: { value: "HSBC" } });
        await waitFor(() => {
            expect(screen.getByText("HSBC UK")).toBeTruthy();
        });

        fireEvent.change(searchInput, { target: { value: "" } });

        await waitFor(() => {
            expect(screen.queryByText("HSBC UK")).toBeNull();
            expect(screen.getByText("Type an institution name to search matching organizations.")).toBeTruthy();
        });
    });

    it("4. Selecting a search candidate passes canonical fiOrgId to createFIEngagement", async () => {
        (searchFIs as any).mockResolvedValueOnce([
            { value: "barclays-org-uuid-123", label: "Barclays Bank PLC", description: "Global Investment Bank" },
        ]);

        render(
            <EngagementManager
                leId={mockLeId}
                initialEngagements={[]}
                leDueDate={null}
            />
        );

        fireEvent.click(screen.getByTitle("Add Supplier Relationship"));
        const searchInput = screen.getByPlaceholderText("Search financial institutions...");

        fireEvent.change(searchInput, { target: { value: "Barclays" } });
        await waitFor(() => {
            expect(screen.getByText("Barclays Bank PLC")).toBeTruthy();
        });

        fireEvent.click(screen.getByText("Barclays Bank PLC"));

        // Must pass canonical fiOrgId ('barclays-org-uuid-123'), NOT string name
        expect(createFIEngagement).toHaveBeenCalledWith(mockLeId, "barclays-org-uuid-123");
    });

    it("5. Free-text 'Create New Entry' button is absent when search yields zero results", async () => {
        (searchFIs as any).mockResolvedValueOnce([]);

        render(
            <EngagementManager
                leId={mockLeId}
                initialEngagements={[]}
                leDueDate={null}
            />
        );

        fireEvent.click(screen.getByTitle("Add Supplier Relationship"));
        const searchInput = screen.getByPlaceholderText("Search financial institutions...");

        fireEvent.change(searchInput, { target: { value: "NonExistentBank" } });

        await waitFor(() => {
            expect(screen.getByText('No financial institutions found matching "NonExistentBank".')).toBeTruthy();
        });

        // Must NOT offer "+ Create New Entry"
        expect(screen.queryByText(/\+ Create New Entry/i)).toBeNull();
    });

    it("6. Already-active relationship remains visible but is disabled and marked 'Already added' by fiOrgId", async () => {
        const mockExistingEngagements = [
            {
                id: "eng-100",
                fiOrgId: "existing-barclays-id",
                org: { id: "existing-barclays-id", name: "Barclays Bank PLC" },
                status: "CONNECTED",
                _count: { sharedDocuments: 0, invitations: 0, memberships: 0 }
            }
        ];

        (searchFIs as any).mockResolvedValueOnce([
            { value: "existing-barclays-id", label: "Barclays Bank PLC", description: "Global Investment Bank" },
            { value: "new-barclays-id", label: "Barclays Bank PLC", description: "Different Jurisdiction Entity" },
        ]);

        render(
            <EngagementManager
                leId={mockLeId}
                initialEngagements={mockExistingEngagements}
                leDueDate={null}
            />
        );

        fireEvent.click(screen.getByTitle("Add Supplier Relationship"));
        const searchInput = screen.getByPlaceholderText("Search financial institutions...");

        fireEvent.change(searchInput, { target: { value: "Barclays" } });

        await waitFor(() => {
            expect(screen.getByText("Already added")).toBeTruthy();
        });

        const dialog = screen.getByRole("dialog");
        const modalItems = within(dialog).getAllByText("Barclays Bank PLC");
        // Exactly 2 candidates inside modal (one existing-barclays-id disabled, one new-barclays-id active)
        expect(modalItems.length).toBe(2);
    });
});
