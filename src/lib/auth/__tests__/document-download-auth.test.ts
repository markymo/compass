import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { canUserDownloadDocument } from "../document-download-auth";

vi.mock("@/lib/prisma", () => ({
    default: {
        document: {
            findUnique: vi.fn()
        },
        membership: {
            findMany: vi.fn()
        },
        clientLEOwner: {
            findMany: vi.fn().mockResolvedValue([])
        }
    }
}));

const prismaMock = prisma as any;

describe("Supplier & Client Document Download Security (canUserDownloadDocument)", () => {
    const userId = "supplier-user-1";

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
    });

    it("1. Reject unauthenticated access (anonymous user)", async () => {
        const result = await canUserDownloadDocument(null, "doc-1");
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(401);
    });

    it("2. Allow Supplier download for document attached to SHARED question in accessible Relationship", async () => {
        prismaMock.document.findUnique.mockResolvedValue({
            id: "doc-shared-1",
            isDeleted: false,
            clientLEId: "cle-1",
            question: {
                status: "SHARED",
                questionnaire: {
                    fiEngagement: { id: "eng-1", fiOrgId: "org-supplier-100", isDeleted: false }
                }
            }
        });

        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-supplier-100", clientLEId: null, fiEngagementId: null, role: "MEMBER", organization: { types: ["FI"] } }
        ]);

        const result = await canUserDownloadDocument(userId, "doc-shared-1");
        expect(result.allowed).toBe(true);
        expect(result.status).toBe(200);
    });

    it("3. Allow Supplier download for document attached to RELEASED question in accessible Relationship", async () => {
        prismaMock.document.findUnique.mockResolvedValue({
            id: "doc-released-1",
            isDeleted: false,
            clientLEId: "cle-1",
            question: {
                status: "RELEASED",
                questionnaire: {
                    fiEngagement: { id: "eng-1", fiOrgId: "org-supplier-100", isDeleted: false }
                }
            }
        });

        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-supplier-100", clientLEId: null, fiEngagementId: null, role: "MEMBER", organization: { types: ["FI"] } }
        ]);

        const result = await canUserDownloadDocument(userId, "doc-released-1");
        expect(result.allowed).toBe(true);
        expect(result.status).toBe(200);
    });

    it("4. REJECT Supplier download for document attached only to DRAFT question", async () => {
        prismaMock.document.findUnique.mockResolvedValue({
            id: "doc-draft-1",
            isDeleted: false,
            clientLEId: "cle-1",
            question: {
                status: "DRAFT",
                questionnaire: {
                    fiEngagement: { id: "eng-1", fiOrgId: "org-supplier-100", isDeleted: false }
                }
            }
        });

        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-supplier-100", clientLEId: null, fiEngagementId: null, role: "MEMBER", organization: { types: ["FI"] } }
        ]);

        const result = await canUserDownloadDocument(userId, "doc-draft-1");
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
        expect(result.reason).toContain("not shared or released");
    });

    it("5. REJECT Supplier download for document attached only to APPROVED question", async () => {
        prismaMock.document.findUnique.mockResolvedValue({
            id: "doc-approved-1",
            isDeleted: false,
            clientLEId: "cle-1",
            question: {
                status: "APPROVED",
                questionnaire: {
                    fiEngagement: { id: "eng-1", fiOrgId: "org-supplier-100", isDeleted: false }
                }
            }
        });

        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-supplier-100", clientLEId: null, fiEngagementId: null, role: "MEMBER", organization: { types: ["FI"] } }
        ]);

        const result = await canUserDownloadDocument(userId, "doc-approved-1");
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
        expect(result.reason).toContain("not shared or released");
    });

    it("6. REJECT Supplier A from downloading Supplier B's visible document (Cross-Tenant Boundary)", async () => {
        prismaMock.document.findUnique.mockResolvedValue({
            id: "doc-shared-supplier-b",
            isDeleted: false,
            clientLEId: "cle-1",
            question: {
                status: "SHARED",
                questionnaire: {
                    fiEngagement: { id: "eng-b", fiOrgId: "org-supplier-OTHER", isDeleted: false }
                }
            }
        });

        // User belongs to org-supplier-100
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-supplier-100", clientLEId: null, fiEngagementId: null, role: "MEMBER", organization: { types: ["FI"] } }
        ]);

        const result = await canUserDownloadDocument(userId, "doc-shared-supplier-b");
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
        expect(result.reason).toContain("lacks relationship authorization");
    });

    it("7. REJECT Supplier download for an unrelated private ClientLE document (not attached to any question)", async () => {
        prismaMock.document.findUnique.mockResolvedValue({
            id: "doc-private-master",
            isDeleted: false,
            clientLEId: "cle-1",
            question: null,
            prefilledForQuestion: null
        });

        // User belongs to org-supplier-100
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-supplier-100", clientLEId: null, fiEngagementId: null, role: "MEMBER", organization: { types: ["FI"] } }
        ]);

        const result = await canUserDownloadDocument(userId, "doc-private-master");
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
        expect(result.reason).toContain("not attached to a visible question");
    });

    it("8. Allow Client-side owner download for clientLE master data documents", async () => {
        prismaMock.document.findUnique.mockResolvedValue({
            id: "doc-client-1",
            isDeleted: false,
            clientLEId: "cle-owner-123",
            question: null
        });

        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-client-1", clientLEId: "cle-owner-123", role: "LE_ADMIN", organization: { types: ["CLIENT"] } }
        ]);

        prismaMock.clientLEOwner.findMany.mockResolvedValue([
            { partyId: "org-client-1" }
        ]);

        const result = await canUserDownloadDocument("client-user-1", "doc-client-1");
        expect(result.allowed).toBe(true);
        expect(result.status).toBe(200);
    });
});
