import { describe, it, expect } from "vitest";
import { resolveFieldCollectionForDisplay, CollectionItemEnvelope } from "../field-interpreter";
import { ResolvedAttachment } from "../field-display-model";

describe("Party item-level attachment distribution & dual-provenance", () => {
    it("distributes party attachments to items based on ccPartyId and preserves complete attachments inventory", () => {
        const docFieldDirect: ResolvedAttachment = {
            documentId: "doc-field-1",
            displayName: "FieldDoc.pdf",
            mimeType: "application/pdf",
            sizeBytes: "1024",
            lifecycleCreatedAt: new Date().toISOString(),
            currentDocumentCreatedAt: new Date().toISOString(),
            provenance: [
                { type: "FIELD", fieldNo: 63, fieldAttachmentInstanceId: "fa-1" }
            ]
        };

        const docPartyA: ResolvedAttachment = {
            documentId: "doc-party-a",
            displayName: "PartyADoc.pdf",
            mimeType: "application/pdf",
            sizeBytes: "2048",
            lifecycleCreatedAt: new Date().toISOString(),
            currentDocumentCreatedAt: new Date().toISOString(),
            provenance: [
                { type: "PARTY", partyId: "party-123", partyName: "Alice Smith", partyDocumentInstanceId: "pda-1" }
            ]
        };

        const docDual: ResolvedAttachment = {
            documentId: "doc-dual",
            displayName: "DualDoc.pdf",
            mimeType: "application/pdf",
            sizeBytes: "4096",
            lifecycleCreatedAt: new Date().toISOString(),
            currentDocumentCreatedAt: new Date().toISOString(),
            provenance: [
                { type: "FIELD", fieldNo: 63, fieldAttachmentInstanceId: "fa-dual" },
                { type: "PARTY", partyId: "party-123", partyName: "Alice Smith", partyDocumentInstanceId: "pda-dual" }
            ]
        };

        const attachmentsInventory = [docFieldDirect, docPartyA, docDual];

        const envelopes: CollectionItemEnvelope[] = [
            {
                instanceId: "row-1",
                value: { ccPartyId: "party-123", forenames: "Alice", surname: "Smith" },
                source: null
            },
            {
                instanceId: "row-2",
                value: { ccPartyId: "party-456", forenames: "Bob", surname: "Jones" },
                source: null
            }
        ];

        const model = resolveFieldCollectionForDisplay(envelopes, {
            fieldNo: 63,
            label: "Directors",
            isMultiValue: true,
            allowAttachments: true,
            attachments: attachmentsInventory
        });

        // 1. Complete inventory is preserved in attachments property
        expect(model.attachments).toHaveLength(3);

        // 2. Direct field-level count filtering (used by top-level paperclip)
        const directFieldDocs = model.attachments.filter(a => a.provenance.some(p => p.type === "FIELD"));
        expect(directFieldDocs).toHaveLength(2); // docFieldDirect and docDual
        expect(directFieldDocs.map(d => d.documentId)).toEqual(["doc-field-1", "doc-dual"]);

        // 3. Item-level distribution
        expect(model.value.kind).toBe("collection");
        if (model.value.kind === "collection") {
            const itemAlice = model.value.items[0];
            const itemBob = model.value.items[1];

            expect(itemAlice.stableKey).toBe("row-1");
            expect(itemAlice.attachments).toHaveLength(2); // docPartyA and docDual
            expect(itemAlice.attachments?.map(a => a.documentId)).toEqual(["doc-party-a", "doc-dual"]);

            expect(itemBob.stableKey).toBe("row-2");
            expect(itemBob.attachments).toBeUndefined(); // Bob has no party documents
        }
    });
});
