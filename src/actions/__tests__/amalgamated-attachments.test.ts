import { resolveAmalgamatedAttachments } from "@/lib/kyc/attachments";
import { KycStateService, DerivedValue } from "@/lib/kyc/KycStateService";
import { CCPartyDocumentService } from "@/lib/documents/party/CCPartyDocumentService";

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/kyc/KycStateService");
vi.mock("@/lib/documents/party/CCPartyDocumentService");

describe("resolveAmalgamatedAttachments", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should amalgamate direct and party attachments", async () => {
        const mockFieldAttachments = new Map();
        mockFieldAttachments.set(10, [{
            instanceId: "inst1",
            attachmentDocumentId: "doc1",
            documentName: "doc1.pdf",
            assertedAt: new Date("2025-01-01")
        }]);

        (KycStateService.resolveAllAttachments as any).mockResolvedValue(mockFieldAttachments);

        const mockPartyDocs = new Map();
        mockPartyDocs.set("partyA", [{
            instanceId: "p-inst1",
            events: [
                { assertedAt: new Date("2025-01-02"), partyId: "partyA", party: { data: { name: "ACME Corp" } } }, // latest
                { assertedAt: new Date("2025-01-01"), partyId: "partyA", party: { data: { name: "ACME Corp" } } }  // oldest
            ],
            document: {
                id: "doc2",
                name: "party_doc.pdf",
                createdAt: new Date("2025-01-01")
            }
        }]);
        
        (CCPartyDocumentService.resolvePartyDocumentsBatch as any).mockResolvedValue(mockPartyDocs);

        const resolvedValues = new Map();
        resolvedValues.set(10, { value: { ccPartyId: "partyA" } } as any);

        const result = await resolveAmalgamatedAttachments({ clientLEId: "client1" }, [10], resolvedValues);
        const atts = result.get(10)!;

        expect(atts).toHaveLength(2);
        
        const doc1 = atts.find(a => a.documentId === "doc1")!;
        expect(doc1.provenance).toHaveLength(1);
        expect(doc1.provenance[0].type).toBe("FIELD");

        const doc2 = atts.find(a => a.documentId === "doc2")!;
        expect(doc2.provenance).toHaveLength(1);
        expect(doc2.provenance[0].type).toBe("PARTY");
        expect((doc2.provenance[0] as any).partyName).toBe("ACME Corp");
    });
});
