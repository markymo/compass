import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import prisma from '@/lib/prisma';
import { addExistingCCPartyReferenceToField, removeMultiValueEntry, createCCPartyAndReferenceField } from '../kyc-manual-update';
import { KycStateService } from '@/lib/kyc/KycStateService';

// Mock security and auth
vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

// Mock permissions
vi.mock('@/lib/auth/permissions', () => ({
    ensureAuthorization: vi.fn().mockResolvedValue(true),
    can: vi.fn().mockReturnValue(true),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

describe.skipIf(!process.env.DATABASE_URL)('kyc-manual-update PARTY_REF Smoke Test', () => {
    let clientLEId: string;
    let subjectLeId: string;
    let ccParty1Id: string;
    let ccParty2Id: string;

    const testLEs: string[] = [];
    const testParties: string[] = [];
    const testClaims: string[] = [];

    beforeEach(async () => {
        // Ensure test user exists in DB
        await prisma.user.upsert({
            where: { id: 'test-user-id' },
            create: { id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
            update: {}
        });

        // 1. Create a ClientLE and its corresponding LegalEntity
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        const le = await prisma.clientLE.create({
            data: {
                name: `PartyRef Smoke LE ${suffix}`,
                shortCode: `S${suffix}`,
                legalEntity: {
                    create: {
                        reference: `REF_${suffix}`,
                        name: `PartyRef Smoke LegalEntity ${suffix}`,
                    }
                }
            },
            include: { legalEntity: true }
        });
        clientLEId = le.id;
        subjectLeId = le.legalEntityId!;
        testLEs.push(le.id);

        // 2. Create two curated CCParty records
        const party1 = await prisma.cCParty.create({
            data: {
                clientLEId: le.id,
                data: {
                    contactType: "PERSON",
                    partyType: "INDIVIDUAL",
                    forenames: "First",
                    surname: "Party",
                    email: "first.party@example.com",
                    roles: [{ roleType: "director" }]
                },
                visibility: "CLIENT_LE",
                createdByUserId: 'test-user-id'
            }
        });
        ccParty1Id = party1.id;
        testParties.push(party1.id);

        const party2 = await prisma.cCParty.create({
            data: {
                clientLEId: le.id,
                data: {
                    contactType: "PERSON",
                    partyType: "INDIVIDUAL",
                    forenames: "Second",
                    surname: "Party",
                    email: "second.party@example.com",
                    roles: [{ roleType: "director" }]
                },
                visibility: "CLIENT_LE",
                createdByUserId: 'test-user-id'
            }
        });
        ccParty2Id = party2.id;
        testParties.push(party2.id);
    });

    afterEach(async () => {
        // Cleanup claims
        await prisma.fieldClaim.deleteMany({
            where: { subjectLeId }
        });

        // Cleanup cc parties
        await prisma.cCParty.deleteMany({
            where: { id: { in: testParties } }
        });

        // Cleanup ClientLE and LegalEntity
        await prisma.clientLE.deleteMany({
            where: { id: { in: testLEs } }
        });
        await prisma.legalEntity.deleteMany({
            where: { clientLEs: { none: {} } }
        });
    });

    it('smoke test: adds two parties, both appear, removes one, remaining one stays', async () => {
        // Step 1: Add existing CCC party 1 to Field 63
        const addRes1 = await addExistingCCPartyReferenceToField(clientLEId, 63, ccParty1Id);
        expect(addRes1.success).toBe(true);

        // Step 2: Add second CCC party to Field 63
        const addRes2 = await addExistingCCPartyReferenceToField(clientLEId, 63, ccParty2Id);
        expect(addRes2.success).toBe(true);

        // Step 3: Verify both appear
        const currentCollection = await KycStateService.getAuthoritativeCollection({ subjectLeId }, 63);
        expect(currentCollection).toHaveLength(2);

        const instanceIds = currentCollection.map(c => c.instanceId);
        expect(instanceIds).toContain(`ccparty_${ccParty1Id}`);
        expect(instanceIds).toContain(`ccparty_${ccParty2Id}`);

        // Fetch the field claim IDs for deletion
        const claim1 = await prisma.fieldClaim.findFirst({
            where: { subjectLeId, fieldNo: 63, instanceId: `ccparty_${ccParty1Id}`, status: 'VERIFIED' }
        });
        const claim2 = await prisma.fieldClaim.findFirst({
            where: { subjectLeId, fieldNo: 63, instanceId: `ccparty_${ccParty2Id}`, status: 'VERIFIED' }
        });
        expect(claim1).not.toBeNull();
        expect(claim2).not.toBeNull();

        // Step 4: Remove one (party 1)
        const removeRes = await removeMultiValueEntry(clientLEId, 63, claim1!.id);
        expect(removeRes.success).toBe(true);

        // Step 5: Remaining one (party 2) stays
        const finalCollection = await KycStateService.getAuthoritativeCollection({ subjectLeId }, 63);
        expect(finalCollection).toHaveLength(1);
        expect(finalCollection[0].instanceId).toBe(`ccparty_${ccParty2Id}`);
    });

    it('smoke test: createCCPartyAndReferenceField generates stable and non-null instanceId', async () => {
        // Test createCCPartyAndReferenceField
        const createRes = await createCCPartyAndReferenceField(
            clientLEId,
            63,
            {
                contactType: "PERSON",
                partyType: "INDIVIDUAL",
                forenames: "Third",
                surname: "Party",
                roles: [{ roleType: "director" }]
            }
        );
        expect(createRes.success).toBe(true);

        // Get newly created CCParty
        const newParty = await prisma.cCParty.findFirst({
            where: { clientLEId, createdFromClaimId: { not: null } }
        });
        expect(newParty).not.toBeNull();
        testParties.push(newParty!.id);

        const currentCollection = await KycStateService.getAuthoritativeCollection({ subjectLeId }, 63);
        expect(currentCollection).toHaveLength(1);
        expect(currentCollection[0].instanceId).toBe(`ccparty_${newParty!.id}`);
    });

    it('smoke test: creating via Field 63 seeds company context into roles[]', async () => {
        const le = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            include: { legalEntity: true }
        });

        const createRes = await createCCPartyAndReferenceField(
            clientLEId,
            63,
            {
                contactType: "PERSON",
                partyType: "INDIVIDUAL",
                forenames: "Eli",
                surname: "Engles",
                roles: []
            }
        );
        expect(createRes.success).toBe(true);

        const allParties = await prisma.cCParty.findMany({ where: { clientLEId } });
        const newParty = allParties.find((p: any) => (p.data as any)?.surname === 'Engles');
        expect(newParty).toBeDefined();
        testParties.push(newParty!.id);

        const data = newParty!.data as any;
        expect(data.roles).toHaveLength(1);
        expect(data.roles[0].roleType).toBe("director");
        expect(data.roles[0].company.name).toBe(le!.name);
        expect(data.roles[0].company.coparityCompanyId).toBe(le!.id);
    });

    it('smoke test: linking existing CCParty via Field 63 appends the role context', async () => {
        const rawParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    contactType: "PERSON",
                    partyType: "INDIVIDUAL",
                    forenames: "Fred",
                    surname: "Fengles",
                    roles: []
                } as any,
                visibility: "CLIENT_LE",
                createdByUserId: 'test-user-id'
            }
        });
        testParties.push(rawParty.id);

        const linkRes = await addExistingCCPartyReferenceToField(clientLEId, 63, rawParty.id);
        expect(linkRes.success).toBe(true);

        const updatedParty = await prisma.cCParty.findUnique({
            where: { id: rawParty.id }
        });
        const data = updatedParty!.data as any;
        expect(data.roles).toHaveLength(1);
        expect(data.roles[0].roleType).toBe("director");
        expect(data.roles[0].company.coparityCompanyId).toBe(clientLEId);
    });

    it('smoke test: linking same CCParty twice does not duplicate the role', async () => {
        const rawParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    contactType: "PERSON",
                    partyType: "INDIVIDUAL",
                    forenames: "Garry",
                    surname: "Gangles",
                    roles: []
                } as any,
                visibility: "CLIENT_LE",
                createdByUserId: 'test-user-id'
            }
        });
        testParties.push(rawParty.id);

        await addExistingCCPartyReferenceToField(clientLEId, 63, rawParty.id);
        await addExistingCCPartyReferenceToField(clientLEId, 63, rawParty.id);

        const updatedParty = await prisma.cCParty.findUnique({
            where: { id: rawParty.id }
        });
        const data = updatedParty!.data as any;
        expect(data.roles).toHaveLength(1);
    });

    it('smoke test: non-Field-63 fields do not get director role enrichment', async () => {
        const rawParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    contactType: "PERSON",
                    partyType: "INDIVIDUAL",
                    forenames: "Hugo",
                    surname: "Hangles",
                    roles: []
                } as any,
                visibility: "CLIENT_LE",
                createdByUserId: 'test-user-id'
            }
        });
        testParties.push(rawParty.id);

        const linkRes = await addExistingCCPartyReferenceToField(clientLEId, 125, rawParty.id);
        expect(linkRes.success).toBe(true);

        const updatedParty = await prisma.cCParty.findUnique({
            where: { id: rawParty.id }
        });
        const data = updatedParty!.data as any;
        expect(data.roles || []).toHaveLength(0);
    });
});
