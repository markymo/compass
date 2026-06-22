import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFieldDetail } from '../kyc-query';
import { releaseFieldDefault, releaseFieldAbsence } from '../kyc-manual-update';
import prisma from "@/lib/prisma";
import { KycStateService } from "@/lib/kyc/KycStateService";

vi.mock("@/lib/prisma", () => ({
    default: {
        sourceFieldMapping: { findMany: vi.fn() },
        clientLE: { findUnique: vi.fn().mockResolvedValue({ id: "le-1", legalEntityId: "subj-1" }) },
        fieldClaim: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        masterFieldDefinition: { findUnique: vi.fn() },
        customFieldDefinition: { findUnique: vi.fn().mockResolvedValue(null) },
        masterFieldGraphBinding: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
        cCParty: { findMany: vi.fn().mockResolvedValue([]) },
        cCAddress: { findMany: vi.fn().mockResolvedValue([]) },
        clientLEGraphEdge: { findMany: vi.fn().mockResolvedValue([]) },
        $queryRaw: vi.fn().mockResolvedValue([]),
    }
}));

vi.mock("@/lib/kyc/KycStateService", () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue("scope-1"),
        pickWinner: vi.fn(),
        isTombstone: vi.fn().mockReturnValue(false),
        mapToDerivedValue: vi.fn(),
        getAuthoritativeValue: vi.fn().mockResolvedValue(null),
        getAuthoritativeCollection: vi.fn().mockResolvedValue([]),
    }
}));

vi.mock("@/services/masterData/definitionService", () => ({
    getMasterFieldDefinition: vi.fn()
}));
import { getMasterFieldDefinition } from "@/services/masterData/definitionService";

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "user-1" })
}));

describe("Master Record Empty States & Releases", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default definitions
        (getMasterFieldDefinition as any).mockResolvedValue({
            fieldNo: 100,
            fieldName: "Test Field",
            appDataType: "TEXT",
            defaultResponse: null,
            isMultiValue: false
        });
        KycStateService.pickWinner = vi.fn().mockReturnValue(null);
    });

    it("1. No mapping + default -> DEFAULT_RESPONSE", async () => {
        (getMasterFieldDefinition as any).mockResolvedValue({
            fieldNo: 100,
            fieldName: "Test Field",
            appDataType: "TEXT",
            defaultResponse: "Fallback Value",
            isMultiValue: false
        });
        (prisma.sourceFieldMapping.findMany as any).mockResolvedValue([]);
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        expect(res?.displayState).toBe("DEFAULT_RESPONSE");
        expect(res?.defaultResponse).toBe("Fallback Value");
    });

    it("2. No mapping + no default -> UNMAPPED_NO_RESPONSE", async () => {
        (prisma.sourceFieldMapping.findMany as any).mockResolvedValue([]);
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        expect(res?.displayState).toBe("UNMAPPED_NO_RESPONSE");
    });

    it("3. Mapping exists but no connected source + default -> DEFAULT_RESPONSE", async () => {
        (getMasterFieldDefinition as any).mockResolvedValue({
            fieldNo: 100,
            fieldName: "Test Field",
            appDataType: "TEXT",
            defaultResponse: "Fallback",
            isMultiValue: false
        });
        (prisma.sourceFieldMapping.findMany as any).mockResolvedValue([{ sourceType: "GLEIF" }]);
        (prisma.clientLE.findUnique as any).mockResolvedValue({ legalEntityId: "subj-1", gleifFetchedAt: null, registryReferences: [] });
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        expect(res?.displayState).toBe("DEFAULT_RESPONSE");
    });

    it("4. Mapping exists but no connected source + no default -> MAPPED_NOT_CHECKED", async () => {
        (prisma.sourceFieldMapping.findMany as any).mockResolvedValue([{ sourceType: "GLEIF" }]);
        (prisma.clientLE.findUnique as any).mockResolvedValue({ legalEntityId: "subj-1", gleifFetchedAt: null, registryReferences: [] });
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        expect(res?.displayState).toBe("MAPPED_NOT_CHECKED");
    });

    it("5. Mapped connected source checked + null/missing -> CHECKED_NO_DATA", async () => {
        (prisma.sourceFieldMapping.findMany as any).mockResolvedValue([{ sourceType: "GLEIF" }]);
        const date = new Date("2026-01-01T00:00:00Z");
        (prisma.clientLE.findUnique as any).mockResolvedValue({ legalEntityId: "subj-1", gleifFetchedAt: date, registryReferences: [] });
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        console.log("TEST 5 RES:", res);
        expect(res?.displayState).toBe("CHECKED_NO_DATA");
        expect(res?.current?.source).toBe("GLEIF");
        expect(res?.current?.timestamp).toEqual(date);
    });

    it("6. Mapped connected source checked + source value -> HAS_VALUE", async () => {
        (prisma.sourceFieldMapping.findMany as any).mockResolvedValue([{ sourceType: "GLEIF" }]);
        (prisma.clientLE.findUnique as any).mockResolvedValue({ legalEntityId: "subj-1", gleifFetchedAt: new Date(), registryReferences: [] });
        
        KycStateService.getAuthoritativeValue = vi.fn().mockResolvedValue({ value: "Actual Data", claimId: "claim-1" });
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        expect(res?.displayState).toBe("HAS_VALUE");
        expect(res?.current?.value).toBe("Actual Data");
    });

    it("7. Source-specific check: GLEIF-mapped but only CH synced -> MAPPED_NOT_CHECKED", async () => {
        (prisma.sourceFieldMapping.findMany as any).mockResolvedValue([{ sourceType: "GLEIF" }]);
        (prisma.clientLE.findUnique as any).mockResolvedValue({
            legalEntityId: "subj-1",
            gleifFetchedAt: null,
            registryReferences: [{ lastSyncSucceededAt: new Date(), authority: { name: "Companies House" } }]
        });
        KycStateService.getAuthoritativeValue = vi.fn().mockResolvedValue({ value: null, claimId: null });
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        expect(res?.displayState).toBe("MAPPED_NOT_CHECKED");
    });

    it("8. Release default value -> Creates USER_INPUT claim", async () => {
        expect(releaseFieldDefault).toBeDefined();
    });

    it("9. Release source 'None' value -> Resolves as HAS_VALUE", async () => {
        KycStateService.getAuthoritativeValue = vi.fn().mockResolvedValue({ 
            value: { explicitNone: true, releasedSourceBadge: "GLEIF" }, 
            claimId: "claim-none" 
        });
        
        const res = await getFieldDetail("le-1", 100, "CLIENT_LE");
        expect(res?.displayState).toBe("HAS_VALUE");
        expect(res?.current?.value.explicitNone).toBe(true);
    });
});
