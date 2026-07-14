import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: {
        sourceFieldMapping: { findMany: vi.fn() },
        registryAuthority:  { findMany: vi.fn() },
    },
}));

import prisma from "@/lib/prisma";
import { mapGleifPayloadToFieldCandidates } from "./src/services/kyc/normalization/GleifNormalizer";

const db  = (prisma as any).sourceFieldMapping;

let _id = 0;
function row(overrides: Record<string, unknown> = {}) {
    return {
        id: `row-${++_id}`,
        sourceType: "GLEIF",
        isActive: true,
        mappingScope: "BASELINE",
        payloadSubtype: "GENERAL",
        transformType: "DIRECT",
        transformConfig: null,
        confidenceDefault: 1.0,
        priority: 10,
        createdAt: new Date(),
        ...overrides,
    };
}

describe("GLEIF Bug Regression Matrix", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _id = 0;
    });

    const payload = {
        id: "213800SN8QHYGA7QUF79",
        type: "lei-records",
        attributes: {
            lei: "213800SN8QHYGA7QUF79",
            entity: {
                legalName: { name: "Example Company" }
            }
        },
        gleifL2: {
            directParent: {
                legalName: "Example Parent Ltd"
            }
        },
        gleifElf: {
            name: "Public Limited Company",
            legalForm: { id: "8G91" }
        }
    };

    // LEVEL 2 RELATIONSHIPS
    it("1. Explicit LEVEL_2_RELATIONSHIPS subtype with a relative path", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 37, sourcePath: "directParent.legalName", payloadSubtype: "LEVEL_2_RELATIONSHIPS" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res[0].value).toBe("Example Parent Ltd");
    });

    it("2. Explicit LEVEL_2_RELATIONSHIPS subtype with a prefixed path (currently failing)", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 37, sourcePath: "gleifL2.directParent.legalName", payloadSubtype: "LEVEL_2_RELATIONSHIPS" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res[0].isExplicitNone).toBe(true);
    });

    it("3. Legacy GENERAL or null subtype with the prefixed path", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 37, sourcePath: "gleifL2.directParent.legalName", payloadSubtype: "GENERAL" }),
            row({ targetFieldNo: 38, sourcePath: "gleifL2.directParent.legalName", payloadSubtype: null }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res.find(c => c.fieldNo === 37)?.value).toBe("Example Parent Ltd");
        expect(res.find(c => c.fieldNo === 38)?.value).toBe("Example Parent Ltd");
    });

    // ELF
    it("5. Explicit ELF subtype with the canonical relative path", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 50, sourcePath: "name", payloadSubtype: "ELF" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res[0].value).toBe("Public Limited Company");
    });

    it("6. Explicit ELF subtype with the currently generated gleifElf.-prefixed path (currently failing)", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 50, sourcePath: "gleifElf.name", payloadSubtype: "ELF" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res[0].isExplicitNone).toBe(true);
    });

    it("7. Legacy GENERAL or null subtype with the full prefixed ELF path", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 50, sourcePath: "gleifElf.name", payloadSubtype: "GENERAL" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res[0].value).toBe("Public Limited Company");
    });

    // Safety and Compatibility
    it("10. A mismatched configuration is not silently accepted", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 50, sourcePath: "gleifElf.name", payloadSubtype: "LEVEL_2_RELATIONSHIPS" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res[0].isExplicitNone).toBe(true);
    });

    it("11. Existing Level 1 mappings continue to resolve unchanged", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 3, sourcePath: "entity.legalName.name", payloadSubtype: "LEVEL_1" }),
            row({ targetFieldNo: 2, sourcePath: "lei", payloadSubtype: "GENERAL" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res.find(c => c.fieldNo === 3)?.value).toBe("Example Company");
        expect(res.find(c => c.fieldNo === 2)?.value).toBe("213800SN8QHYGA7QUF79");
    });

    it("12. mappingScope: BASELINE and mappingScope: RAW_PAYLOAD produce the same GLEIF result", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 3, sourcePath: "entity.legalName.name", mappingScope: "BASELINE" }),
            row({ targetFieldNo: 4, sourcePath: "entity.legalName.name", mappingScope: "RAW_PAYLOAD" }),
        ]);
        const res = await mapGleifPayloadToFieldCandidates(payload, "ev");
        expect(res.find(c => c.fieldNo === 3)?.value).toBe("Example Company");
        expect(res.find(c => c.fieldNo === 4)?.value).toBe("Example Company");
    });
});
