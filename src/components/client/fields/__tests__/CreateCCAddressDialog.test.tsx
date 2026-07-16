/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Mock the actions
import { upsertCCAddress } from "@/actions/cc-address-actions";
vi.mock("@/actions/cc-address-actions", () => ({
    upsertCCAddress: vi.fn(),
}));

// Mock AddressValueEditor to just be a simple div
vi.mock("../AddressValueEditor", () => ({
    AddressValueEditor: ({ onChange }: any) => (
        <div data-testid="mock-address-editor">
            <button onClick={() => onChange({ addressLines: ["123 Test St"] })}>Set Mock Value</button>
        </div>
    )
}));

import { CreateCCAddressDialog } from "../CreateCCAddressDialog";

describe("CreateCCAddressDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("renders and manages address creation flow", async () => {
        const onOpenChange = vi.fn();
        const onSuccess = vi.fn();

        (upsertCCAddress as any).mockResolvedValue({
            success: true,
            ccAddress: { id: "new-addr-123" }
        });

        render(
            <CreateCCAddressDialog
                clientLEId="le-123"
                open={true}
                onOpenChange={onOpenChange}
                onSuccess={onSuccess}
            />
        );

        expect(screen.getByText("Create New Address")).toBeInTheDocument();

        // Change value
        fireEvent.click(screen.getByText("Set Mock Value"));

        // Save
        fireEvent.click(screen.getByText("Save & Select"));

        await waitFor(() => {
            expect(upsertCCAddress).toHaveBeenCalledWith({
                clientLEId: "le-123",
                data: expect.objectContaining({ addressLines: ["123 Test St"] })
            });
        });

        // Ensure onSuccess fires exactly once and onOpenChange is called with false
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledWith({ ccAddressId: "new-addr-123" });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("handles persistence failures without calling onSuccess or closing", async () => {
        const onOpenChange = vi.fn();
        const onSuccess = vi.fn();

        (upsertCCAddress as any).mockRejectedValue(new Error("Network Error"));

        render(
            <CreateCCAddressDialog
                clientLEId="le-123"
                open={true}
                onOpenChange={onOpenChange}
                onSuccess={onSuccess}
            />
        );

        fireEvent.click(screen.getByText("Save & Select"));

        await waitFor(() => {
            expect(upsertCCAddress).toHaveBeenCalled();
        });

        expect(onSuccess).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
