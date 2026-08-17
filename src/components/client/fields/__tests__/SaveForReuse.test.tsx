import { describe, it, expect, vi } from "vitest";
import { FieldValueRenderer } from "../FieldValueRenderer";
import { PartyRenderer } from "../PartyRenderer";
import { AddressRenderer } from "../AddressRenderer";
import { CollectionRenderer } from "../CollectionRenderer";
import { PersonOrContactValueViewer } from "../PersonOrContactValueViewer";
import { AddressValueViewer } from "../AddressValueViewer";
import { FieldDisplayModel, SaveForReuseHandler } from "@/lib/master-data/field-display-model";
import { PartyValue } from "@/lib/master-data/party-value";
import { AddressValue } from "@/lib/master-data/address-value";

describe("Save for Reuse — Canonical Renderers & Viewers", () => {
    // 1. source-derived individual director → Save for reuse
    it("1. passes claimId, onSaveForReuse handler to PartyRenderer and PersonOrContactValueViewer for individual director", () => {
        const handler: SaveForReuseHandler = vi.fn();
        const partyData: PartyValue = {
            contactType: "INDIVIDUAL",
            partyType: "INDIVIDUAL",
            title: "Mr",
            forenames: "John",
            surname: "Doe",
            nationality: ["British"],
            countryOfResidence: "UK",
            email: "john@example.com",
            phones: [],
            roles: [{ roleType: "DIRECTOR", roleTitle: "Director", appointedOn: "2020-01-01", resignedOn: null, natureOfControl: [], isActiveRole: true }],
            sourceIdentifiers: [],
            correspondenceAddress: null,
            isActivePersonOrContact: true
        };

        const model: FieldDisplayModel = {
            fieldNo: 63,
            label: "Directors",
            state: "POPULATED",
            value: { kind: "party", data: partyData, summary: "John Doe", partyLabel: "Director" },
            source: { type: "COMPANY_REGISTRY", label: "Companies House", colorKey: "blue", category: "REGISTRY" },
            textSummary: "John Doe",
            isEditable: false,
            isMultiValue: false,
            allowAttachments: false,
            attachments: []
        };

        const element: any = FieldValueRenderer({
            field: model,
            claimId: "claim-director-1",
            onSaveForReuse: handler
        });

        expect(element?.type?.name || element?.type?.displayName).toBe("PartyRenderer");
        expect(element?.props?.claimId).toBe("claim-director-1");
        expect(element?.props?.onSaveForReuse).toBe(handler);

        const partyElement: any = PartyRenderer(element.props);
        const viewerElement: any = partyElement?.props?.children;

        expect(viewerElement?.props?.claimId).toBe("claim-director-1");
        expect(viewerElement?.props?.onSaveForReuse).toBe(handler);

        // Verify PersonOrContactValueViewer renders action button when onSaveForReuse is provided
        const viewerRender: any = PersonOrContactValueViewer(viewerElement.props);
        expect(viewerRender?.type).toBe("span");
        
        const actionBtn: any = viewerRender.props.children[2]; // renderActionButton()
        expect(actionBtn).toBeTruthy();
        expect(actionBtn?.props?.title).toContain("Save this party");

        // Simulate clicking action button
        actionBtn.props.onClick({ stopPropagation: vi.fn() });
        expect(handler).toHaveBeenCalledWith({
            kind: "EMBEDDED_PARTY",
            claimId: "claim-director-1",
            party: partyData
        });
    });

    // 2. corporate/organisation party → correct reusable entity behaviour
    it("2. renders 'Save for reuse' for source-derived corporate/organisation party", () => {
        const handler: SaveForReuseHandler = vi.fn();
        const partyData: PartyValue = {
            contactType: "ORGANISATION",
            partyType: "ORGANISATION",
            legalName: "Acme Holdings Ltd",
            companyNumber: "12345678",
            jurisdiction: "GB",
            email: null,
            phones: [],
            roles: [{ roleType: "DIRECTOR", roleTitle: "Corporate Director", appointedOn: null, resignedOn: null, natureOfControl: [], isActiveRole: true }],
            sourceIdentifiers: [{ scheme: "GB_COH", value: "12345678" }],
            correspondenceAddress: null,
            isActivePersonOrContact: true
        };

        const viewerRender: any = PersonOrContactValueViewer({
            value: partyData,
            layout: "compact",
            claimId: "claim-corp-1",
            onSaveForReuse: handler
        });

        const actionBtn: any = viewerRender.props.children[2];
        expect(actionBtn).toBeTruthy();
        
        actionBtn.props.onClick({ stopPropagation: vi.fn() });
        expect(handler).toHaveBeenCalledWith({
            kind: "EMBEDDED_PARTY",
            claimId: "claim-corp-1",
            party: partyData
        });
    });

    // 3. two-director collection → saving one saves only that item
    it("3. in a two-director collection, passing onSaveForReuse binds each director's specific claimId", () => {
        const handler: SaveForReuseHandler = vi.fn();

        const directorA: PartyValue = {
            contactType: "INDIVIDUAL",
            forenames: "Alice",
            surname: "Smith",
            nationality: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            correspondenceAddress: null,
            isActivePersonOrContact: true
        };

        const directorB: PartyValue = {
            contactType: "INDIVIDUAL",
            forenames: "Bob",
            surname: "Jones",
            nationality: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            correspondenceAddress: null,
            isActivePersonOrContact: true
        };

        const collectionModel: FieldDisplayModel = {
            fieldNo: 63,
            label: "Directors",
            state: "POPULATED",
            value: {
                kind: "collection",
                items: [
                    {
                        claimId: "claim-dir-a",
                        isPromotedToCCC: false,
                        value: { kind: "party", data: directorA, summary: "Alice Smith", partyLabel: "Director" }
                    },
                    {
                        claimId: "claim-dir-b",
                        isPromotedToCCC: false,
                        value: { kind: "party", data: directorB, summary: "Bob Jones", partyLabel: "Director" }
                    }
                ]
            },
            source: { type: "COMPANY_REGISTRY", label: "Companies House", colorKey: "blue", category: "REGISTRY" },
            textSummary: "Alice Smith, Bob Jones",
            isEditable: false,
            isMultiValue: true,
            allowAttachments: false,
            attachments: []
        };

        const element: any = FieldValueRenderer({
            field: collectionModel,
            onSaveForReuse: handler
        });

        expect(element?.type?.name || element?.type?.displayName).toBe("CollectionRenderer");
        expect(element?.props?.onSaveForReuse).toBe(handler);

        const collectionRender: any = CollectionRenderer(element.props);
        const visibleItems = collectionRender.props.children[1].props.children;
        expect(visibleItems).toHaveLength(2);

        // Render Item A
        const itemAFieldValue: any = visibleItems[0].props.children.props.children;
        expect(itemAFieldValue?.props?.claimId).toBe("claim-dir-a");
        expect(itemAFieldValue?.props?.onSaveForReuse).toBe(handler);

        const partyARenderer: any = FieldValueRenderer(itemAFieldValue.props);
        const partyAViewer: any = PartyRenderer(partyARenderer.props);
        const viewerARender: any = PersonOrContactValueViewer(partyAViewer.props.children.props);

        // Click Save for reuse on Director A
        const btnA: any = viewerARender.props.children[1];
        btnA.props.onClick({ stopPropagation: vi.fn() });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({
            kind: "EMBEDDED_PARTY",
            claimId: "claim-dir-a",
            party: directorA
        });

        // Item B has distinct claimId "claim-dir-b"
        const itemBFieldValue: any = visibleItems[1].props.children.props.children;
        expect(itemBFieldValue?.props?.claimId).toBe("claim-dir-b");
    });

    // 4. source-derived address → Save for reuse
    it("4. renders 'Save for reuse' for source-derived address when onSaveForReuse is provided", () => {
        const handler: SaveForReuseHandler = vi.fn();
        const addressData: AddressValue = {
            addressLines: ["10 Downing Street"],
            locality: "London",
            postalCode: "SW1A 2AA",
            countryCode: "GB",
            countryName: "United Kingdom"
        };

        const model: FieldDisplayModel = {
            fieldNo: 138,
            label: "Registered Address",
            state: "POPULATED",
            value: { kind: "address", data: addressData, summary: "10 Downing Street, London" },
            source: { type: "COMPANY_REGISTRY", label: "Companies House", colorKey: "blue", category: "REGISTRY" },
            textSummary: "10 Downing Street, London",
            isEditable: false,
            isMultiValue: false,
            allowAttachments: false,
            attachments: []
        };

        const element: any = FieldValueRenderer({
            field: model,
            claimId: "claim-address-1",
            onSaveForReuse: handler
        });

        expect(element?.type?.name || element?.type?.displayName).toBe("AddressRenderer");
        const addressRender: any = AddressRenderer(element.props);
        const viewerElement: any = addressRender?.props?.children;

        const viewerRender: any = AddressValueViewer(viewerElement.props);
        const actionBtn: any = viewerRender.props.children[1];
        expect(actionBtn).toBeTruthy();

        actionBtn.props.onClick({ stopPropagation: vi.fn() });
        expect(handler).toHaveBeenCalledWith({
            kind: "ADDRESS",
            claimId: "claim-address-1",
            address: addressData
        });
    });

    // 5. already-saved item → correct saved state
    it("5. renders 'Saved for reuse' badge when item is already promoted to CCC", () => {
        const handler: SaveForReuseHandler = vi.fn();
        const partyData: PartyValue = {
            contactType: "INDIVIDUAL",
            forenames: "Jane",
            surname: "Doe",
            nationality: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            correspondenceAddress: null,
            isActivePersonOrContact: true
        };

        const viewerRender: any = PersonOrContactValueViewer({
            value: partyData,
            layout: "compact",
            claimId: "claim-saved-1",
            isPromotedToCCC: true,
            onSaveForReuse: handler
        });

        const badge: any = viewerRender.props.children[2];
        expect(badge).toBeTruthy();
        expect(badge?.props?.children[1]).toBe("Saved for reuse");
    });

    // 6. no supplied capability/handler → no action
    it("6. renders in pure read-only mode (no action button) when onSaveForReuse is not supplied", () => {
        const partyData: PartyValue = {
            contactType: "INDIVIDUAL",
            forenames: "Jane",
            surname: "Doe",
            nationality: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            correspondenceAddress: null,
            isActivePersonOrContact: true
        };

        const viewerRender: any = PersonOrContactValueViewer({
            value: partyData,
            layout: "compact",
            claimId: "claim-read-only-1"
        });

        const actionNode: any = viewerRender.props.children[2];
        expect(actionNode).toBeNull();
    });

    // 7. F63 application fixture regression test
    it("7. F63 Director row fixture (from getFieldDetail data.rows) receives claimId and onSaveForReuse in PersonOrContactValueViewer", () => {
        const handler: SaveForReuseHandler = vi.fn();

        // Realistic Companies House director claim object as returned in data.rows by getFieldDetail
        const f63DirectorRow = {
            id: "claim-coh-dir-99",
            fieldNo: 63,
            source: "COMPANY_REGISTRY",
            isPromotedToCCC: false,
            value: {
                contactType: "INDIVIDUAL",
                partyType: "INDIVIDUAL",
                title: "Dr",
                forenames: "Eleanor",
                surname: "Vance",
                nationality: ["British"],
                dateOfBirth: { month: 4, year: 1978 },
                roles: [{ roleType: "DIRECTOR", roleTitle: "Director", appointedOn: "2018-03-12" }]
            }
        };

        // Render PersonOrContactValueViewer as field-detail-panel renders it for each repeating row
        const viewerRender: any = PersonOrContactValueViewer({
            value: f63DirectorRow.value,
            layout: "row",
            claimId: f63DirectorRow.id,
            isPromotedToCCC: f63DirectorRow.isPromotedToCCC,
            onSaveForReuse: handler
        });

        // Verify action button is present in row layout (child index 1)
        const actionBtn: any = viewerRender.props.children[1];
        expect(actionBtn).toBeTruthy();
        expect(actionBtn?.props?.children[1]).toBe("Save for reuse");

        // Click action button
        actionBtn.props.onClick({ stopPropagation: vi.fn() });
        expect(handler).toHaveBeenCalledWith({
            kind: "EMBEDDED_PARTY",
            claimId: "claim-coh-dir-99",
            party: f63DirectorRow.value
        });
    });
});
