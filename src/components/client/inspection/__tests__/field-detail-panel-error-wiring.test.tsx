/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { showActionErrorToast, copyActionErrorToClipboard, formatErrorForClipboard } from "@/components/ui/copyable-error-toast";
import { FieldDetailPanel } from "../field-detail-panel";
import * as kycQuery from "@/actions/kyc-query";
import * as kycManualUpdate from "@/actions/kyc-manual-update";
import { toast } from "sonner";

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock("@/actions/kyc-query", () => ({
    getFieldDetail: vi.fn(),
}));

vi.mock("@/actions/kyc-manual-update", () => ({
    updateFieldManually: vi.fn(),
    removeMultiValueEntry: vi.fn(),
    addMultiValueEntry: vi.fn(),
    clearSingleValueEntry: vi.fn(),
    addCodeListEntry: vi.fn(),
}));

vi.mock("@/actions/system", () => ({
    getRegistryAuthorityNamesMap: vi.fn().mockResolvedValue({})
}));

vi.mock("@/actions/kanban-actions", () => ({
    getLETeamMembers: vi.fn().mockResolvedValue({ success: true, members: [] })
}));

vi.mock("@/actions/client-le", () => ({
    getFieldUsageDetails: vi.fn().mockResolvedValue({
        totalQuestions: 0,
        totalQuestionnaires: 0,
        totalSuppliers: 0,
        relationships: [],
        questions: [],
        questionnaires: [],
        suppliers: []
    }),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: { user: { name: "Test User" } }, status: "authenticated" }),
}));

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));

vi.mock("@/components/client/fields/FieldAttachments", () => ({
    FieldAttachments: () => <div data-testid="mock-attachments" />
}));

describe("ONP-43 — Master Record Drawer Action Error Wiring & Copyable Toast", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("1. Formats unexpected Master Record action failure into copyable clipboard payload", () => {
        const text = formatErrorForClipboard("Failed to update field", {
            errorRef: "ERR-KYC-9912",
            timestamp: "2026-08-31T10:00:00.000Z",
            operation: "updateScalarField",
            technicalDetails: "Connection pool exhausted",
        });

        expect(text).toContain("OnPro error");
        expect(text).toContain("Failed to update field");
        expect(text).toContain("Reference: ERR-KYC-9912");
        expect(text).toContain("Operation: updateScalarField");
        expect(text).toContain("Technical Details:\nConnection pool exhausted");
    });

    it("2. Wires Master Record action error to render selectable UI with Copy button", () => {
        const failure = {
            success: false,
            kind: "unexpected" as const,
            message: "Failed to update field",
            errorRef: "ERR-MASTER-101",
            timestamp: "2026-08-31T10:00:00.000Z",
            operation: "updateField",
            technicalDetails: "PrismaClientKnownRequestError",
        };

        showActionErrorToast(failure, "Default error");

        expect(toast.error).toHaveBeenCalled();
        const toastArg = vi.mocked(toast.error).mock.calls[0][0];
        
        // Assert that a React element was passed to toast.error
        expect(React.isValidElement(toastArg)).toBe(true);

        // Render the toast element
        const { container } = render(toastArg as React.ReactElement);

        // Assert selectable text classes are present
        expect(container.querySelector(".select-text")).not.toBeNull();
        expect(container.querySelector(".select-all")).not.toBeNull();
        expect(screen.getByText("Failed to update field")).toBeDefined();
        expect(screen.getByText("ERR-MASTER-101")).toBeDefined();

        // Assert Copy error button exists
        const copyButton = screen.getByRole("button", { name: "Copy error" });
        expect(copyButton).toBeDefined();
    });

    it("3. Clicking Copy error copies formatted details to navigator.clipboard", async () => {
        const writeTextSpy = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText: writeTextSpy },
            configurable: true,
            writable: true,
        });

        const failure = {
            success: false,
            kind: "unexpected" as const,
            message: "Failed to clear value",
            errorRef: "ERR-CLEAR-202",
        };

        showActionErrorToast(failure);
        const toastArg = vi.mocked(toast.error).mock.calls[0][0];
        render(toastArg as React.ReactElement);

        const copyButton = screen.getByRole("button", { name: "Copy error" });
        fireEvent.click(copyButton);

        expect(writeTextSpy).toHaveBeenCalled();
        const copiedContent = writeTextSpy.mock.calls[0][0];
        expect(copiedContent).toContain("Failed to clear value");
        expect(copiedContent).toContain("Reference: ERR-CLEAR-202");
    });

    it("4. FieldDetailPanel component renders copyable error toast with errorRef on server action failure", async () => {
        // Mock getFieldDetail to return a populated single-value field
        vi.mocked(kycQuery.getFieldDetail).mockResolvedValue({
            fieldName: "Legal Name",
            fieldNo: 3,
            category: "Identity",
            description: "Registered legal name",
            isRepeating: false,
            current: {
                value: "Acme Corporation",
                source: "USER_INPUT",
                timestamp: new Date().toISOString(),
                state: "POPULATED",
                sourceDisplayName: "Manual Entry"
            },
            candidates: [],
            rows: [],
            attachments: [],
            fieldModel: null,
            history: [],
            userNote: "",
            assignment: null
        } as any);

        // Mock clearSingleValueEntry to fail with an ActionFailure containing errorRef
        vi.mocked(kycManualUpdate.clearSingleValueEntry).mockResolvedValue({
            success: false,
            kind: "unexpected",
            message: "Database transaction failed",
            errorRef: "ERR-DRAWER-7788",
            timestamp: new Date().toISOString(),
            operation: "clearSingleValueEntry",
            technicalDetails: "Connection timeout"
        } as any);

        render(
            <FieldDetailPanel
                open={true}
                onOpenChange={vi.fn()}
                clientLEId="client-le-1"
                fieldNo={3}
                fieldName="Legal Name"
                value="Acme Corporation"
                source="USER_INPUT"
                timestamp={new Date()}
            />
        );

        // Wait for field details to load
        await waitFor(() => {
            expect(screen.getByText("Acme Corporation")).toBeDefined();
        });

        // Click the Clear value button (title="Clear value")
        await waitFor(() => {
            expect(screen.getByTitle("Clear value")).toBeDefined();
        });
        const clearTrigger = screen.getByTitle("Clear value");
        fireEvent.click(clearTrigger);

        // Find and click the confirmation "Yes, clear" button
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Yes, clear" })).toBeDefined();
        });
        const confirmClear = screen.getByRole("button", { name: "Yes, clear" });
        fireEvent.click(confirmClear);

        // Assert that clearSingleValueEntry was executed
        await waitFor(() => {
            expect(kycManualUpdate.clearSingleValueEntry).toHaveBeenCalledWith("client-le-1", 3);
        });

        // Verify that showActionErrorToast was invoked and passed the errorRef React component to toast.error
        expect(toast.error).toHaveBeenCalled();
        const toastCallArg = vi.mocked(toast.error).mock.calls[0][0];
        expect(React.isValidElement(toastCallArg)).toBe(true);

        const { container } = render(toastCallArg as React.ReactElement);
        expect(container.textContent).toContain("Database transaction failed");
        expect(container.textContent).toContain("ERR-DRAWER-7788");
        expect(screen.getByRole("button", { name: "Copy error" })).toBeDefined();
    });
});
