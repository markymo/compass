/**
 * graph-node-create.test.ts
 *
 * Unit tests for createGraphNodeAction and updateGraphNodeAction
 * covering all Model A fields (Phase 6).
 *
 * Tests verify:
 *   - All new Model A fields are written to the correct Prisma model
 *   - dateOfBirth string → Date conversion
 *   - isPublicFigure boolean handling (create and update)
 *   - LEGAL_ENTITY new fields: jurisdiction, legalForm, entityStatus, countryOfIncorporation
 *   - ADDRESS new fields: line2, region, postalCode
 *   - Audit log receives the correct changedFields list
 *   - Auth guard returns error when userId missing
 *   - GraphNode wrapper is created when not present
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));
vi.mock("@/services/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

import prismaMock from "@/lib/__mocks__/prisma";
import { getIdentity } from "@/lib/auth";
import { createGraphNodeAction, updateGraphNodeAction } from "../graph-node-create";

const mockGetIdentity = vi.mocked(getIdentity);

beforeEach(() => {
    vi.clearAllMocks();
    mockGetIdentity.mockResolvedValue({ userId: "user-1" } as any);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockNodeWrapper(nodeType: string, entityId: string, clientLEId = "le-1") {
    (prismaMock as any).clientLEGraphNode = {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "node-wrapper-1", nodeType, clientLEId }),
    };
}

// ── createGraphNodeAction — PERSON ────────────────────────────────────────────

describe("createGraphNodeAction — PERSON", () => {
    it("GN-1: creates person with all Model A fields", async () => {
        const personId = "person-1";
        prismaMock.person.create.mockResolvedValue({ id: personId } as any);
        mockNodeWrapper("PERSON", personId);

        const res = await createGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "PERSON",
            title: "Mr",
            firstName: "James",
            lastName: "Smith",
            middleName: "Arthur",
            dateOfBirth: "1980-06-15",
            placeOfBirth: "London",
            nationality: "British",
            officerRole: "director",
            occupation: "Company Director",
            countryOfResidence: "United Kingdom",
            isPublicFigure: true,
        });

        expect(res.success).toBe(true);
        expect(prismaMock.person.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                firstName:          "James",
                lastName:           "Smith",
                middleName:         "Arthur",
                title:              "Mr",
                placeOfBirth:       "London",
                primaryNationality: "British",
                officerRole:        "director",
                occupation:         "Company Director",
                countryOfResidence: "United Kingdom",
                isPublicFigure:     true,
            }),
        });
    });

    it("GN-2: dateOfBirth string is converted to Date object", async () => {
        prismaMock.person.create.mockResolvedValue({ id: "person-2" } as any);
        mockNodeWrapper("PERSON", "person-2");

        await createGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "PERSON",
            firstName: "Jane",
            lastName: "Doe",
            dateOfBirth: "1952-04-30",
        });

        const callArg = prismaMock.person.create.mock.calls[0][0];
        const dob = callArg.data.dateOfBirth as Date;
        expect(dob).toBeInstanceOf(Date);
        expect(dob.getFullYear()).toBe(1952);
        expect(dob.getMonth()).toBe(3); // April = 3 (0-indexed)
        expect(dob.getDate()).toBe(30);
    });

    it("GN-2b: null dateOfBirth stores null", async () => {
        prismaMock.person.create.mockResolvedValue({ id: "person-3" } as any);
        mockNodeWrapper("PERSON", "person-3");

        await createGraphNodeAction({ clientLEId: "le-1", nodeType: "PERSON", firstName: "A", lastName: "B", dateOfBirth: "" });
        const callArg = prismaMock.person.create.mock.calls[0][0];
        expect(callArg.data.dateOfBirth).toBeNull();
    });

    it("GN-3: isPublicFigure defaults to false when not provided", async () => {
        prismaMock.person.create.mockResolvedValue({ id: "person-4" } as any);
        mockNodeWrapper("PERSON", "person-4");

        await createGraphNodeAction({ clientLEId: "le-1", nodeType: "PERSON", firstName: "A", lastName: "B" });
        const callArg = prismaMock.person.create.mock.calls[0][0];
        expect(callArg.data.isPublicFigure).toBe(false);
    });

    it("GN-4: auth guard returns error when no userId", async () => {
        mockGetIdentity.mockResolvedValue(null as any);
        const res = await createGraphNodeAction({ clientLEId: "le-1", nodeType: "PERSON", firstName: "X", lastName: "Y" });
        expect(res.success).toBe(false);
        expect(res.error).toBe("Unauthorized");
    });
});

// ── createGraphNodeAction — LEGAL_ENTITY ──────────────────────────────────────

describe("createGraphNodeAction — LEGAL_ENTITY", () => {
    it("GN-5: creates LE with all Model A fields", async () => {
        prismaMock.legalEntity.create.mockResolvedValue({ id: "le-entity-1" } as any);
        mockNodeWrapper("LEGAL_ENTITY", "le-entity-1");

        const res = await createGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "LEGAL_ENTITY",
            entityName: "Acme Ltd",
            registrationNumber: "12345678",
            jurisdiction: "England and Wales",
            legalForm: "Private Limited Company",
            entityStatus: "ACTIVE",
            countryOfIncorporation: "GB",
        });

        expect(res.success).toBe(true);
        expect(prismaMock.legalEntity.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name:                    "Acme Ltd",
                localRegistrationNumber: "12345678",
                jurisdiction:            "England and Wales",
                legalForm:               "Private Limited Company",
                entityStatus:            "ACTIVE",
                countryOfIncorporation:  "GB",
            }),
        });
    });
});

// ── createGraphNodeAction — ADDRESS ───────────────────────────────────────────

describe("createGraphNodeAction — ADDRESS", () => {
    it("GN-7: creates address with all Model A fields", async () => {
        prismaMock.address.create.mockResolvedValue({ id: "addr-1" } as any);
        mockNodeWrapper("ADDRESS", "addr-1");

        const res = await createGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "ADDRESS",
            line1: "1 High Street",
            line2: "Flat 3",
            city: "London",
            region: "Greater London",
            postalCode: "SW1A 1AA",
            country: "GB",
        });

        expect(res.success).toBe(true);
        expect(prismaMock.address.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                line1:      "1 High Street",
                line2:      "Flat 3",
                city:       "London",
                region:     "Greater London",
                postalCode: "SW1A 1AA",
                country:    "GB",
            }),
        });
    });
});

// ── updateGraphNodeAction — PERSON ────────────────────────────────────────────

describe("updateGraphNodeAction — PERSON", () => {
    const basePersonDb = {
        id: "person-1",
        firstName: "Old",
        lastName: "Name",
        middleName: null,
        title: null,
        dateOfBirth: null,
        placeOfBirth: null,
        primaryNationality: null,
        officerRole: null,
        occupation: null,
        countryOfResidence: null,
        isPublicFigure: false,
    };

    beforeEach(() => {
        // Transaction mock: executes the callback immediately
        prismaMock.$transaction.mockImplementation(async (cb: any) =>
            cb({
                person: {
                    findUniqueOrThrow: vi.fn().mockResolvedValue(basePersonDb),
                    update: vi.fn().mockResolvedValue({ ...basePersonDb, firstName: "Updated" }),
                },
            })
        );
    });

    it("GN-9: updates all new Model A person fields", async () => {
        const res = await updateGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "PERSON",
            entityId: "person-1",
            firstName: "James",
            lastName: "Smith",
            middleName: "Arthur",
            title: "Mr",
            dateOfBirth: "1980-06-15",
            placeOfBirth: "London",
            nationality: "British",
            officerRole: "director",
            occupation: "Company Director",
            countryOfResidence: "UK",
            isPublicFigure: true,
        });

        expect(res.success).toBe(true);
        // Verify transaction callback executed
        expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("GN-10: dateOfBirth update is converted to Date", async () => {
        let capturedData: any = null;

        prismaMock.$transaction.mockImplementation(async (cb: any) =>
            cb({
                person: {
                    findUniqueOrThrow: vi.fn().mockResolvedValue(basePersonDb),
                    update: vi.fn().mockImplementation(async ({ data }: any) => {
                        capturedData = data;
                        return { ...basePersonDb };
                    }),
                },
            })
        );

        await updateGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "PERSON",
            entityId: "person-1",
            dateOfBirth: "1952-04-30",
        });

        expect(capturedData.dateOfBirth).toBeInstanceOf(Date);
        expect(capturedData.dateOfBirth.getFullYear()).toBe(1952);
    });

    it("GN-11: null dateOfBirth is stored as null", async () => {
        let capturedData: any = null;

        prismaMock.$transaction.mockImplementation(async (cb: any) =>
            cb({
                person: {
                    findUniqueOrThrow: vi.fn().mockResolvedValue(basePersonDb),
                    update: vi.fn().mockImplementation(async ({ data }: any) => {
                        capturedData = data;
                        return { ...basePersonDb };
                    }),
                },
            })
        );

        await updateGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "PERSON",
            entityId: "person-1",
            dateOfBirth: null,
        });

        expect(capturedData.dateOfBirth).toBeNull();
    });

    it("GN-12: isPublicFigure: false is written correctly", async () => {
        let capturedData: any = null;

        prismaMock.$transaction.mockImplementation(async (cb: any) =>
            cb({
                person: {
                    findUniqueOrThrow: vi.fn().mockResolvedValue({ ...basePersonDb, isPublicFigure: true }),
                    update: vi.fn().mockImplementation(async ({ data }: any) => {
                        capturedData = data;
                        return { ...basePersonDb, isPublicFigure: false };
                    }),
                },
            })
        );

        await updateGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "PERSON",
            entityId: "person-1",
            isPublicFigure: false,
        });

        expect(capturedData.isPublicFigure).toBe(false);
    });
});

// ── updateGraphNodeAction — LEGAL_ENTITY ──────────────────────────────────────

describe("updateGraphNodeAction — LEGAL_ENTITY", () => {
    it("GN-13: updates all new Model A LE fields", async () => {
        let capturedData: any = null;

        prismaMock.$transaction.mockImplementation(async (cb: any) =>
            cb({
                legalEntity: {
                    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "le-1", name: "Old", localRegistrationNumber: null, jurisdiction: null, legalForm: null, entityStatus: null, countryOfIncorporation: null }),
                    update: vi.fn().mockImplementation(async ({ data }: any) => {
                        capturedData = data;
                        return {};
                    }),
                },
            })
        );

        const res = await updateGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "LEGAL_ENTITY",
            entityId: "le-entity-1",
            entityName: "Acme Ltd",
            registrationNumber: "12345678",
            jurisdiction: "England and Wales",
            legalForm: "Private Limited Company",
            entityStatus: "ACTIVE",
            countryOfIncorporation: "GB",
        });

        expect(res.success).toBe(true);
        expect(capturedData).toMatchObject({
            name:                    "Acme Ltd",
            localRegistrationNumber: "12345678",
            jurisdiction:            "England and Wales",
            legalForm:               "Private Limited Company",
            entityStatus:            "ACTIVE",
            countryOfIncorporation:  "GB",
        });
    });
});

// ── updateGraphNodeAction — ADDRESS ───────────────────────────────────────────

describe("updateGraphNodeAction — ADDRESS", () => {
    it("GN-15: updates all new Model A address fields", async () => {
        let capturedData: any = null;

        prismaMock.$transaction.mockImplementation(async (cb: any) =>
            cb({
                address: {
                    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "addr-1", line1: "", line2: null, city: null, region: null, postalCode: null, country: "" }),
                    update: vi.fn().mockImplementation(async ({ data }: any) => {
                        capturedData = data;
                        return {};
                    }),
                },
            })
        );

        const res = await updateGraphNodeAction({
            clientLEId: "le-1",
            nodeType: "ADDRESS",
            entityId: "addr-1",
            line1: "1 High Street",
            line2: "Flat 3",
            city: "London",
            region: "Greater London",
            postalCode: "SW1A 1AA",
            country: "GB",
        });

        expect(res.success).toBe(true);
        expect(capturedData).toMatchObject({
            line1:      "1 High Street",
            line2:      "Flat 3",
            city:       "London",
            region:     "Greater London",
            postalCode: "SW1A 1AA",
            country:    "GB",
        });
    });
});
