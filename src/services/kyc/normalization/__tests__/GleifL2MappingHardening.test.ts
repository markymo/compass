import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma for normalizer testing
vi.mock("@/lib/prisma", () => ({
    default: {
        sourceFieldMapping: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
        registryAuthority:  { findMany: vi.fn() },
        masterFieldDefinition: { findUnique: vi.fn() },
    },
}));
vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "test-user-id" })
}));

import prisma from "@/lib/prisma";
import { applyTransform } from "../transforms";
import { mapGleifPayloadToFieldCandidates } from "../GleifNormalizer";
import { upsertSourceMapping } from "@/actions/source-mappings";

const db = (prisma as any).sourceFieldMapping;

const REAL_WORLD_ZZOOMM_PAYLOAD = {
    lei: "98450084A57489967A93",
    legalName: "ZZOOMM GROUP LIMITED",
    legalFormId: "H0PO",
    entityStatus: "ACTIVE",
    jurisdiction: "GB",
    registeredAs: "11734368",
    registeredAt: "RA000585",
    registrationStatus: "ISSUED"
};

describe("GLEIF Level 2 Mapping Hardening & TO_PARTY_ORGANISATION", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. TO_PARTY_ORGANISATION transforms real-world GleifL2Entity payload to complete PartyValue", () => {
        const result = applyTransform(REAL_WORLD_ZZOOMM_PAYLOAD, "TO_PARTY_ORGANISATION");
        expect(result.value).not.toBeNull();
        const party = result.value;

        expect(party.partyType).toBe("ORGANISATION");
        expect(party.organisationName).toBe("ZZOOMM GROUP LIMITED");
        expect(party.displayName).toBe("ZZOOMM GROUP LIMITED");
        expect(party.registrationNumber).toBe("11734368");
        expect(party.incorporatedIn).toBe("GB");
        expect(party.contactType).toBe("CONTACT");
        expect(party.sourceIdentifiers).toEqual([
            { scheme: "LEI", value: "98450084A57489967A93" }
        ]);
        expect(party.isActiveParty).toBe(true);
        expect(party.isActivePersonOrContact).toBe(true);
    });

    it("2. GleifNormalizer produces canonical Organisation Party for gleifL2.ultimateParent when payloadSubtype is LEVEL_2_RELATIONSHIPS", async () => {
        db.findMany.mockResolvedValue([
            {
                id: "m-40",
                sourceType: "GLEIF",
                targetFieldNo: 40,
                sourcePath: "gleifL2.ultimateParent",
                payloadSubtype: "LEVEL_2_RELATIONSHIPS",
                transformType: "DIRECT",
                isActive: true,
                confidenceDefault: 1.0,
                priority: 100
            }
        ]);

        const fullPayload = {
            attributes: { lei: "BASE_LEI", entity: { legalName: { name: "Child Co" } } },
            gleifL2: {
                ultimateParent: REAL_WORLD_ZZOOMM_PAYLOAD
            }
        };

        const candidates = await mapGleifPayloadToFieldCandidates(fullPayload, "ev-l2-test");
        expect(candidates).toHaveLength(1);
        const cand = candidates[0];
        expect(cand.fieldNo).toBe(40);
        expect(cand.source).toBe("GLEIF");
        expect(cand.value.partyType).toBe("ORGANISATION");
        expect(cand.value.organisationName).toBe("ZZOOMM GROUP LIMITED");
        expect(cand.value.registrationNumber).toBe("11734368");
        expect(cand.value.sourceIdentifiers).toContainEqual({ scheme: "LEI", value: "98450084A57489967A93" });
    });

    it("3. GleifNormalizer produces canonical Organisation Party for gleifL2.directParent when payloadSubtype is LEVEL_2_RELATIONSHIPS", async () => {
        db.findMany.mockResolvedValue([
            {
                id: "m-38",
                sourceType: "GLEIF",
                targetFieldNo: 38,
                sourcePath: "gleifL2.directParent",
                payloadSubtype: "LEVEL_2_RELATIONSHIPS",
                transformType: "DIRECT",
                isActive: true,
                confidenceDefault: 1.0,
                priority: 100
            }
        ]);

        const fullPayload = {
            attributes: { lei: "BASE_LEI", entity: { legalName: { name: "Child Co" } } },
            gleifL2: {
                directParent: REAL_WORLD_ZZOOMM_PAYLOAD
            }
        };

        const candidates = await mapGleifPayloadToFieldCandidates(fullPayload, "ev-direct-test");
        expect(candidates).toHaveLength(1);
        const cand = candidates[0];
        expect(cand.fieldNo).toBe(38);
        expect(cand.value.partyType).toBe("ORGANISATION");
        expect(cand.value.organisationName).toBe("ZZOOMM GROUP LIMITED");
    });

    it("4. GleifNormalizer does NOT force TO_PARTY_ORGANISATION if mapping is incorrectly set to LEVEL_1 (no special case override)", async () => {
        db.findMany.mockResolvedValue([
            {
                id: "m-bad-scope",
                sourceType: "GLEIF",
                targetFieldNo: 40,
                sourcePath: "gleifL2.ultimateParent",
                payloadSubtype: "LEVEL_1", // Misconfigured
                transformType: "DIRECT",
                isActive: true,
                confidenceDefault: 1.0,
                priority: 100
            }
        ]);

        const fullPayload = {
            attributes: { lei: "BASE_LEI" },
            gleifL2: {
                ultimateParent: REAL_WORLD_ZZOOMM_PAYLOAD
            }
        };

        const candidates = await mapGleifPayloadToFieldCandidates(fullPayload, "ev-bad-scope");
        // Because payloadSubtype is LEVEL_1, line 86 fallback resolves raw object, but line 115 check for LEVEL_2_RELATIONSHIPS evaluates to false.
        // Therefore transform stays DIRECT and value is the raw object (not converted to PartyValue).
        expect(candidates).toHaveLength(1);
        expect(candidates[0].value.partyType).toBeUndefined();
        expect(candidates[0].value.lei).toBe("98450084A57489967A93");
    });

    it("5. upsertSourceMapping server action rejects invalid gleifL2.* scope combination", async () => {
        (prisma as any).masterFieldDefinition.findUnique.mockResolvedValue({
            fieldNo: 40,
            fieldName: "Ultimate parent (>50%)",
            isActive: true
        });

        const result = await upsertSourceMapping({
            sourceType: "GLEIF",
            sourcePath: "gleifL2.ultimateParent",
            targetFieldNo: 40,
            payloadSubtype: "LEVEL_1" // Invalid for gleifL2.* path!
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('GLEIF source paths starting with "gleifL2." must use GLEIF Data Scope "LEVEL_2_RELATIONSHIPS"');
    });
});
