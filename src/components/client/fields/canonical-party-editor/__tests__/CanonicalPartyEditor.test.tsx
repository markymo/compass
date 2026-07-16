/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

vi.mock("next-auth", () => ({
    default: vi.fn(() => ({
        handlers: {},
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn()
    }))
}));
vi.mock("next/server", () => ({ NextResponse: {} }));

import { CanonicalPartyEditor } from "../CanonicalPartyEditor";
import { CanonicalPartyFormState } from "../state-mappers";
import fs from "fs";
import path from "path";

describe("CanonicalPartyEditor Integrations", () => {
    let mockFormState: CanonicalPartyFormState;
    let onChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onChange = vi.fn();
        mockFormState = {
            partyType: "INDIVIDUAL",
            knownAs: null,
            isActiveParty: true,
            identity: {
                title: null,
                forenames: "John",
                surname: "Doe",
                legalName: null,
                teamName: null,
                nationality: [],
                placeOfBirth: null,
                dateOfBirth: { year: "", month: "", day: "" }
            },
            emails: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            homeAddressRef: { ccAddressId: "home-123" },
            registeredAddressRef: null,
            correspondenceAddressRef: null,
            legacyTopLevelAddressDiagnostics: []
        };
    });

    it("handles party-type switching and address-reference transitions cleanly", () => {
        // Mock window.confirm to return true
        window.confirm = vi.fn().mockReturnValue(true);

        render(
            <CanonicalPartyEditor 
                clientLEId="client-1" 
                formState={mockFormState} 
                onChange={onChange}
                isNew={true}
            />
        );

        // Click Organisation
        const orgRadio = screen.getByLabelText("Organisation");
        fireEvent.click(orgRadio);

        expect(onChange).toHaveBeenCalledTimes(1);
        const newState = onChange.mock.calls[0][0];

        expect(newState.partyType).toBe("ORGANISATION");
        // Identity data is wiped
        expect(newState.identity.forenames).toBeNull();
        expect(newState.identity.surname).toBeNull();
        // Address refs are reset
        expect(newState.homeAddressRef).toBeNull();
        expect(newState.registeredAddressRef).toBeNull();
    });

    it("proves that no address mutation action is imported or called from CanonicalPartyEditor", () => {
        const source = fs.readFileSync(path.join(__dirname, '../CanonicalPartyEditor.tsx'), 'utf-8');
        expect(source).not.toContain('upsertCCAddress');
        expect(source).not.toContain('createCCAddress');
        expect(source).not.toContain('@/actions/cc-address-actions');
    });

    it("proves that no address mutation action is imported or called from PartyRolesSection", () => {
        const source = fs.readFileSync(path.join(__dirname, '../PartyRolesSection.tsx'), 'utf-8');
        expect(source).not.toContain('upsertCCAddress');
        expect(source).not.toContain('createCCAddress');
        expect(source).not.toContain('@/actions/cc-address-actions');
    });
});
