/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { showActionErrorToast, copyActionErrorToClipboard, formatErrorForClipboard } from "@/components/ui/copyable-error-toast";
import { toast } from "sonner";

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
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
});
