/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import { LegacyAddressWarning } from "../LegacyAddressWarning";
import { CanonicalPartyFormState } from "../state-mappers";

describe("LegacyAddressWarning", () => {
    const baseState: CanonicalPartyFormState = {
        partyType: "INDIVIDUAL",
        knownAs: null,
        isActiveParty: true,
        identity: {
            title: null,
            forenames: null,
            surname: null,
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
        homeAddressRef: null,
        registeredAddressRef: null,
        correspondenceAddressRef: null,
        legacyTopLevelAddressDiagnostics: []
    };

    afterEach(() => {
        cleanup();
    });

    it("returns null if there are no legacy diagnostics", () => {
        const { container } = render(<LegacyAddressWarning state={baseState} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders unresolved top-level warnings when no canonical reference exists", () => {
        const state = {
            ...baseState,
            legacyTopLevelAddressDiagnostics: ["homeAddress"]
        };
        render(<LegacyAddressWarning state={state} />);
        
        expect(screen.getByText("Legacy homeAddress")).toBeInTheDocument();
        expect(screen.getByText(/If you save any changes to this Party, these old-format addresses will NOT be carried/i)).toBeInTheDocument();
        expect(screen.queryByText("(Resolved)")).not.toBeInTheDocument();
    });

    it("renders visually resolved state when a canonical reference is selected", () => {
        const state: CanonicalPartyFormState = {
            ...baseState,
            legacyTopLevelAddressDiagnostics: ["homeAddress"],
            homeAddressRef: { ccAddressId: "valid-ref" }
        };
        render(<LegacyAddressWarning state={state} />);
        
        // Component still visible (per requirements)
        expect(screen.getByText(/If you save any changes to this Party/i)).toBeInTheDocument();
        
        // Specific diagnostic slot is visually resolved
        expect(screen.getByText("Legacy homeAddress")).toHaveClass("line-through");
        expect(screen.getByText("(Resolved)")).toBeInTheDocument();
    });

    it("un-resolves dynamically if the reference is cleared", () => {
        // This is proven by the lack of the `line-through` and `(Resolved)` 
        // when the state reverts to null. We'll simulate the state changes here.
        const { rerender } = render(<LegacyAddressWarning state={{
            ...baseState,
            legacyTopLevelAddressDiagnostics: ["homeAddress"],
            homeAddressRef: { ccAddressId: "valid-ref" }
        }} />);
        expect(screen.getByText("(Resolved)")).toBeInTheDocument();

        // Clear reference
        rerender(<LegacyAddressWarning state={{
            ...baseState,
            legacyTopLevelAddressDiagnostics: ["homeAddress"],
            homeAddressRef: null
        }} />);
        expect(screen.queryByText("(Resolved)")).not.toBeInTheDocument();
    });

    it("handles role-level legacy diagnostics correctly", () => {
        const state: CanonicalPartyFormState = {
            ...baseState,
            roles: [
                {
                    rowId: "1",
                    roleType: "Director",
                    roleTitle: null,
                    isActiveRole: null,
                    appointedOn: null,
                    resignedOn: null,
                    company: { name: null, externalId: null, externalIdScheme: null, onProCompanyId: null },
                    natureOfControl: [],
                    correspondenceAddressRef: { ccAddressId: "ref-123" }, // Selected!
                    legacyEmbeddedAddressDiagnostic: "correspondenceAddress",
                    legacyEmbeddedAddressRaw: {}
                },
                {
                    rowId: "2",
                    roleType: "Shareholder",
                    roleTitle: null,
                    isActiveRole: null,
                    appointedOn: null,
                    resignedOn: null,
                    company: { name: null, externalId: null, externalIdScheme: null, onProCompanyId: null },
                    natureOfControl: [],
                    correspondenceAddressRef: null, // Not selected!
                    legacyEmbeddedAddressDiagnostic: "correspondenceAddress",
                    legacyEmbeddedAddressRaw: {}
                }
            ]
        };

        render(<LegacyAddressWarning state={state} />);

        // One resolved, one unresolved
        const resolvedTags = screen.getAllByText("(Resolved)");
        expect(resolvedTags).toHaveLength(1);
    });
});
