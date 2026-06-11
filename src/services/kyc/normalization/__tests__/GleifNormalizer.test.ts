/**
 * GleifNormalizer unit tests
 *
 * Tests the DB-driven GLEIF mapping path end-to-end using real pathResolver
 * and applyTransform — only prisma is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock prisma ────────────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
    default: {
        sourceFieldMapping: { findMany: vi.fn() },
        registryAuthority:  { findMany: vi.fn() },
    },
}));

import prisma from "@/lib/prisma";
import { mapGleifPayloadToFieldCandidates } from "../GleifNormalizer";

const db  = (prisma as any).sourceFieldMapping;
const raDb = (prisma as any).registryAuthority;

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Canonical GLEIF attributes root (what the normalizer receives after envelope strip) */
const ATTR = {
    lei: "213800SN8QHYGA7QUF79",
    entity: {
        legalName: { name: "HSBC Holdings plc", language: "en" },
        // otherNames shaped to be compatible with TO_NAME_HISTORY_LIST
        // (note: real GLEIF format may differ; this exercises the transform plumbing)
        otherNames: [{ name: "Old Name Ltd", ceased_on: "2010-01-01" }],
        legalAddress: {
            addressLines: ["8 Canada Square"],
            city: "London",
            region: "GB-LND",
            country: "GB",
            postalCode: "E14 5HQ",
        },
        headquartersAddress: { city: "Canary Wharf" },
        category: "GENERAL",
        status: "ACTIVE",
        creationDate: "1959-01-01T00:00:00.000Z",
        // registeredAt — present in real GLEIF payloads
        registeredAt: { id: "RA000192", other: null },
    },
    registration: {
        managingLou: "EVK05KS7XY1DEII3R011",
    },
};

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GleifNormalizer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _id = 0;
        // Default: no RA rows needed for most tests
        raDb.findMany.mockResolvedValue([]);
    });

    // GN-1: DB-driven path produces candidates
    it("GN-1: DB rows produce FieldCandidates with correct fieldNo / source / evidenceId", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 2,  sourcePath: "lei" }),
            row({ targetFieldNo: 3,  sourcePath: "entity.legalName.name" }),
            row({ targetFieldNo: 26, sourcePath: "entity.status" }),
        ]);

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-001");

        expect(candidates).toHaveLength(3);
        expect(candidates.every((c) => c.source === "GLEIF")).toBe(true);
        expect(candidates.every((c) => c.evidenceId === "ev-001")).toBe(true);
        const nos = candidates.map((c) => c.fieldNo).sort((a, b) => a - b);
        expect(nos).toEqual([2, 3, 26]);
    });

    // GN-2: Payload envelope extraction — three wrapper shapes
    it("GN-2: resolves attributes from data.attributes, attributes, and bare payload", async () => {
        db.findMany.mockResolvedValue([row({ targetFieldNo: 2, sourcePath: "lei" })]);

        const [a, b, c] = await Promise.all([
            mapGleifPayloadToFieldCandidates({ data: { attributes: ATTR } }, "ev-002"),
            mapGleifPayloadToFieldCandidates({ attributes: ATTR }, "ev-002"),
            mapGleifPayloadToFieldCandidates(ATTR, "ev-002"),
        ]);

        expect(a).toHaveLength(1);
        expect(b).toHaveLength(1);
        expect(c).toHaveLength(1);
        expect(a[0].value).toBe("213800SN8QHYGA7QUF79");
        expect(b[0].value).toBe("213800SN8QHYGA7QUF79");
        expect(c[0].value).toBe("213800SN8QHYGA7QUF79");
    });

    // GN-3: Priority deduplication — lower number wins
    it("GN-3: priority deduplication emits only one candidate per target field", async () => {
        // findMany returns rows already sorted priority ASC (mirrors real DB orderBy)
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 3, sourcePath: "entity.legalName.name",     priority: 10 }),
            row({ targetFieldNo: 3, sourcePath: "entity.legalName.language", priority: 20 }),
        ]);

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-003");

        expect(candidates).toHaveLength(1);
        expect(candidates[0].value).toBe("HSBC Holdings plc"); // priority 10 wins
    });

    // GN-4: DATE_TO_ISO applied to F27
    it("GN-4: DATE_TO_ISO transform is applied for F27 creation date", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 27, sourcePath: "entity.creationDate", transformType: "DATE_TO_ISO" }),
        ]);

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-004");

        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(27);
        expect(typeof candidates[0].value).toBe("string");
        // GLEIF returns ISO 8601; DATE_TO_ISO is idempotent on ISO input
        expect(candidates[0].value as string).toContain("1959");
    });

    // GN-5: Path resolving to null → no candidate
    it("GN-5: missing source path produces no candidate", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 8, sourcePath: "entity.legalAddress.region" }),
        ]);

        const payloadNoRegion = {
            ...ATTR,
            entity: {
                ...ATTR.entity,
                legalAddress: { city: "London", country: "GB" }, // region absent
            },
        };

        const candidates = await mapGleifPayloadToFieldCandidates(payloadNoRegion, "ev-005");

        expect(candidates).toHaveLength(0);
    });

    // GN-6: F12 scope anomaly — RAW_PAYLOAD scope / null subtype are ignored
    it("GN-6: F12 with mappingScope=RAW_PAYLOAD resolves correctly (scope is ignored)", async () => {
        db.findMany.mockResolvedValue([
            row({
                targetFieldNo: 12,
                sourcePath:    "entity.headquartersAddress.city",
                mappingScope:  "RAW_PAYLOAD",
                payloadSubtype: null,
            }),
        ]);

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-006");

        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(12);
        expect(candidates[0].value).toBe("Canary Wharf");
    });

    // GN-7: TO_NAME_HISTORY_LIST for F5
    it("GN-7: TO_NAME_HISTORY_LIST produces an array candidate for F5", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 5, sourcePath: "entity.otherNames", transformType: "TO_NAME_HISTORY_LIST" }),
        ]);

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-007");

        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(5);
        expect(Array.isArray(candidates[0].value)).toBe(true);
        expect(candidates[0].source).toBe("GLEIF");
    });

    // GN-8: Empty DB → [] + console.error
    it("GN-8: empty DB returns [] and logs console.error", async () => {
        db.findMany.mockResolvedValue([]);
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-008");

        expect(candidates).toEqual([]);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining("[GleifNormalizer]"));
        spy.mockRestore();
    });

    // GN-9: DB error → [] + console.error
    it("GN-9: DB error returns [] and logs console.error with the thrown error", async () => {
        const dbErr = new Error("DB connection failed");
        db.findMany.mockRejectedValue(dbErr);
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-009");

        expect(candidates).toEqual([]);
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining("[GleifNormalizer]"),
            dbErr
        );
        spy.mockRestore();
    });

    // GN-10: RA_CODE_TO_NAME — normalizer pre-loads RA lookup and injects it
    it("GN-10: RA_CODE_TO_NAME mapping resolves registeredAt.id to authority name", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 17, sourcePath: "entity.registeredAt.id", transformType: "RA_CODE_TO_NAME" }),
        ]);
        raDb.findMany.mockResolvedValue([
            { id: "RA000192", name: "Registre du Commerce et des Sociétés (France)" },
            { id: "RA000585", name: "Companies House" },
        ]);

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-010");

        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(17);
        expect(candidates[0].value).toBe("Registre du Commerce et des Sociétés (France)");
        expect(candidates[0].source).toBe("GLEIF");
        // registryAuthority.findMany called exactly once (preloaded, not per-field)
        expect(raDb.findMany).toHaveBeenCalledTimes(1);
    });

    // GN-11: registryAuthority.findMany is NOT called when no RA_CODE_TO_NAME mapping is active
    it("GN-11: registryAuthority.findMany is skipped when no RA_CODE_TO_NAME mapping is present", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 2, sourcePath: "lei", transformType: "DIRECT" }),
            row({ targetFieldNo: 3, sourcePath: "entity.legalName.name", transformType: "DIRECT" }),
        ]);
        // raDb.findMany already mocked to return [] in beforeEach — assert it is never called

        const candidates = await mapGleifPayloadToFieldCandidates(ATTR, "ev-011");

        expect(candidates).toHaveLength(2);
        expect(raDb.findMany).not.toHaveBeenCalled();
    });

    // GN-12: resolves enriched paths (gleifL2.*, gleifElf.*) from root payload via fallback
    it("GN-12: resolves enriched paths (gleifL2.*, gleifElf.*) from root payload via fallback", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 30, sourcePath: "gleifL2.directParent.legalName", transformType: "DIRECT" }),
            row({ targetFieldNo: 31, sourcePath: "gleifElf.name", transformType: "DIRECT" }),
        ]);

        const payload = {
            id: "213800SN8QHYGA7QUF79",
            type: "lei-records",
            attributes: ATTR,
            gleifL2: {
                directParent: {
                    legalName: "HSBC Group East Asia Holdings Limited"
                }
            },
            gleifElf: {
                name: "Public Limited Company"
            }
        };

        const candidates = await mapGleifPayloadToFieldCandidates(payload, "ev-012");

        expect(candidates).toHaveLength(2);
        const c30 = candidates.find(c => c.fieldNo === 30);
        const c31 = candidates.find(c => c.fieldNo === 31);
        expect(c30).toBeDefined();
        expect(c30?.value).toBe("HSBC Group East Asia Holdings Limited");
        expect(c31).toBeDefined();
        expect(c31?.value).toBe("Public Limited Company");
    });

    // GN-13: preserves backward compatibility for standard paths resolving against attributes even when fallback conditions are not met
    it("GN-13: preserves backward compatibility for standard paths resolving against attributes even when fallback conditions are not met", async () => {
        db.findMany.mockResolvedValue([
            row({ targetFieldNo: 3, sourcePath: "entity.legalName.name", transformType: "DIRECT" }),
            row({ targetFieldNo: 30, sourcePath: "gleifL2.directParent.legalName", transformType: "DIRECT" }),
        ]);

        const payload = {
            id: "213800SN8QHYGA7QUF79",
            type: "lei-records",
            attributes: ATTR,
            // gleifL2 is missing or null
            gleifL2: null
        };

        const candidates = await mapGleifPayloadToFieldCandidates(payload, "ev-013");

        expect(candidates).toHaveLength(1);
        expect(candidates[0].fieldNo).toBe(3);
        expect(candidates[0].value).toBe("HSBC Holdings plc");
    });
});
