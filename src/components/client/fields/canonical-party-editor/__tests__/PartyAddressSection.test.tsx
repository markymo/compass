/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import { PartyAddressSection } from "../PartyAddressSection";
import fs from "fs";
import path from "path";
import { CCAddressSelector } from "../../CCAddressSelector";

// Mock CCAddressSelector
vi.mock("../../CCAddressSelector", () => ({
    CCAddressSelector: vi.fn(({ currentRef, label }) => (
        <div data-testid="cc-address-selector">
            <span>Mocked Selector</span>
            {currentRef && <span data-testid="mock-ref">{currentRef.ccAddressId}</span>}
        </div>
    ))
}));

describe("PartyAddressSection", () => {
    afterEach(() => {
        cleanup();
    });

    it("renders label and delegates to CCAddressSelector", () => {
        render(
            <PartyAddressSection 
                clientLEId="client-123"
                label="Home Address Test"
                currentRef={{ ccAddressId: "ref-456" }}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText(/Home Address Test/i)).toBeInTheDocument();
        expect(screen.getByTestId("cc-address-selector")).toBeInTheDocument();
        expect(screen.getByTestId("mock-ref")).toHaveTextContent("ref-456");
    });

    it("proves that no address mutation action is imported or called from PartyAddressSection", () => {
        const source = fs.readFileSync(path.join(__dirname, '../PartyAddressSection.tsx'), 'utf-8');
        
        // Ensure no imports of server actions
        expect(source).not.toContain('upsertCCAddress');
        expect(source).not.toContain('createCCAddress');
        expect(source).not.toContain('@/actions/cc-address-actions');
        expect(source).not.toContain('AddressValueEditor');
        expect(source).not.toContain('Dialog');
    });
});
