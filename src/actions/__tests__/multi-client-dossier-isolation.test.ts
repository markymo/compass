import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { createClientLE, deleteClientLE, restoreClientLECore } from '../client';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockImplementation(async () => ({ userId: (globalThis as any).__TEST_USER_ID__ || 'user-123' }))
}));

vi.mock('@/lib/auth/permissions', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        can: vi.fn().mockResolvedValue(true)
    };
});

vi.mock('@/domain/registry', () => ({
    LegalEntityEnrichmentService: {
        bootstrapEntity: vi.fn().mockResolvedValue(true)
    }
}));

describe.skipIf(!process.env.DATABASE_URL)('Multi-Client LE Dossier Isolation & Fresh Re-Creation Tests', () => {
    let orgA: any;
    let orgB: any;
    let userA: any;
    let testLei: string;

    beforeEach(async () => {
        testLei = `TEST-LEI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        orgA = await prisma.organization.create({
            data: { name: 'Client Org Alpha', types: ['CLIENT'] }
        });

        orgB = await prisma.organization.create({
            data: { name: 'Client Org Beta', types: ['CLIENT'] }
        });

        userA = await prisma.user.create({
            data: { email: `admin-a-${Date.now()}@alpha.com`, name: 'Admin Alpha' }
        });

        (globalThis as any).__TEST_USER_ID__ = userA.id;

        await prisma.membership.create({
            data: { userId: userA.id, organizationId: orgA.id, role: 'ORG_ADMIN' }
        });
        await prisma.membership.create({
            data: { userId: userA.id, organizationId: orgB.id, role: 'ORG_ADMIN' }
        });
    });

    afterEach(async () => {
        if (testLei) {
            const clientLEs = await prisma.clientLE.findMany({ where: { lei: testLei }, select: { id: true, legalEntityId: true } });
            const leIds = clientLEs.map(c => c.id);
            const legalEntityIds = clientLEs.map(c => c.legalEntityId).filter(Boolean) as string[];

            await prisma.fieldClaim.deleteMany({ where: { clientLEId: { in: leIds } } });
            await prisma.clientLEOwner.deleteMany({ where: { clientLEId: { in: leIds } } });
            await prisma.clientLE.deleteMany({ where: { lei: testLei } });
            if (legalEntityIds.length > 0) {
                await prisma.legalEntity.deleteMany({ where: { id: { in: legalEntityIds } } });
            }
        }

        const orgIds = [orgA?.id, orgB?.id].filter(Boolean);
        if (orgIds.length > 0) {
            await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
        }

        if (orgA) await prisma.organization.delete({ where: { id: orgA.id } });
        if (orgB) await prisma.organization.delete({ where: { id: orgB.id } });
        if (userA) await prisma.user.delete({ where: { id: userA.id } });
    });

    it('1. Allows Org A and Org B to maintain independent ClientLE dossiers for the SAME LegalEntity/LEI', async () => {
        const resA = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        console.log("createClientLE result A:", resA);
        expect(resA.success).toBe(true);
        const leA = resA.data;

        const resB = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgB.id,
            lei: testLei
        });
        expect(resB.success).toBe(true);
        const leB = resB.data;

        expect(leA.id).not.toBe(leB.id);
        expect(leA.legalEntityId).toBeDefined();
        expect(leA.legalEntityId).toBe(leB.legalEntityId);
    });

    it('2. Enforces strict dossier-level FieldClaim isolation between Org A and Org B', async () => {
        const resA = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        const leA = resA.data;

        const resB = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgB.id,
            lei: testLei
        });
        const leB = resB.data;

        // Assert F83 claim for Org A
        await FieldClaimService.assertClaim({
            fieldNo: 83,
            clientLEId: leA.id,
            subjectLeId: leA.legalEntityId!,
            valueText: 'Alpha Confidential F83 Data',
            sourceType: 'USER_INPUT' as any,
            claimRole: 'VALUE'
        });

        // Query Org A's dossier -> returns Alpha data
        const valA = await KycStateService.getAuthoritativeValue(
            { subjectLeId: leA.legalEntityId!, clientLEId: leA.id },
            83
        );
        expect(valA?.value).toBe('Alpha Confidential F83 Data');

        // Query Org B's dossier -> returns NULL (strict isolation!)
        const valB = await KycStateService.getAuthoritativeValue(
            { subjectLeId: leB.legalEntityId!, clientLEId: leB.id },
            83
        );
        expect(valB).toBeNull();
    });

    it('3. Re-adding an entity after deletion creates a fresh dossier with clean state, leaving old dossier soft-deleted', async () => {
        // Step 1: Create initial dossier
        const res1 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        const originalLE = res1.data;

        // Assert confidential F83 data
        await FieldClaimService.assertClaim({
            fieldNo: 83,
            clientLEId: originalLE.id,
            subjectLeId: originalLE.legalEntityId!,
            valueText: 'Old Sensitive F83 Input',
            sourceType: 'USER_INPUT' as any,
            claimRole: 'VALUE'
        });

        // Step 2: Delete dossier
        const delRes = await deleteClientLE(originalLE.id);
        expect(delRes.success).toBe(true);

        // Step 3: Re-add entity to Org A
        const res2 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        expect(res2.success).toBe(true);
        const freshLE = res2.data;

        // Prove fresh LE is a new dossier record
        expect(freshLE.id).not.toBe(originalLE.id);

        // Prove fresh LE has NO F83 data (clean slate!)
        const freshVal = await KycStateService.getAuthoritativeValue(
            { subjectLeId: freshLE.legalEntityId!, clientLEId: freshLE.id },
            83
        );
        expect(freshVal).toBeNull();

        // Prove old dossier remains soft-deleted and intact for System Admin restore
        const oldLE = await prisma.clientLE.findUnique({ where: { id: originalLE.id } });
        expect(oldLE?.isDeleted).toBe(true);

        // To test restore of A1 when A2 exists:
        // A2 must be soft-deleted first because of the One-Current-Dossier rule!
        await deleteClientLE(freshLE.id);

        // Prove System Admin can now restore the old dossier A1
        await restoreClientLECore(originalLE.id);

        const restoredVal = await KycStateService.getAuthoritativeValue(
            { subjectLeId: originalLE.legalEntityId!, clientLEId: originalLE.id },
            83
        );
        expect(restoredVal?.value).toBe('Old Sensitive F83 Input');
    });

    it('4. Enforces strict dossier-level FieldClaim isolation between same-client dossiers A1 and A2 sharing LegalEntity and ownerScopeId', async () => {
        const resA1 = await createClientLE({
            name: 'Fusion UK Finco A1',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        const leA1 = resA1.data;

        // Delete A1 to allow creation of A2 within Org A
        await deleteClientLE(leA1.id);

        const resA2 = await createClientLE({
            name: 'Fusion UK Finco A2',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        const leA2 = resA2.data;

        // Soft-delete A2 so A1 can be restored safely
        await deleteClientLE(leA2.id);
        await restoreClientLECore(leA1.id);

        // Assert F83 = "Alpha" for A1
        await FieldClaimService.assertClaim({
            fieldNo: 83,
            clientLEId: leA1.id,
            subjectLeId: leA1.legalEntityId!,
            valueText: 'Alpha',
            sourceType: 'USER_INPUT' as any,
            claimRole: 'VALUE'
        });

        // Delete A1 and restore A2
        await deleteClientLE(leA1.id);
        await restoreClientLECore(leA2.id);

        // Assert F83 = "Beta" for A2
        await FieldClaimService.assertClaim({
            fieldNo: 83,
            clientLEId: leA2.id,
            subjectLeId: leA2.legalEntityId!,
            valueText: 'Beta',
            sourceType: 'USER_INPUT' as any,
            claimRole: 'VALUE'
        });

        // Query A2 -> returns "Beta"
        const valA2 = await KycStateService.getAuthoritativeValue(
            { subjectLeId: leA2.legalEntityId!, clientLEId: leA2.id },
            83
        );
        expect(valA2?.value).toBe('Beta');

        // Delete A2 and restore A1
        await deleteClientLE(leA2.id);
        await restoreClientLECore(leA1.id);

        // Query A1 -> returns "Alpha"
        const valA1 = await KycStateService.getAuthoritativeValue(
            { subjectLeId: leA1.legalEntityId!, clientLEId: leA1.id },
            83
        );
        expect(valA1?.value).toBe('Alpha');
    });

    it('5. Blocks duplicate creation in same Org when a current dossier exists, but allows cross-client creation in Org B', async () => {
        const resA1 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        expect(resA1.success).toBe(true);

        // Attempt 2 in Org A -> BLOCKED
        const resA2 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        expect(resA2.success).toBe(false);
        expect(resA2.error).toContain('already exists in your organisation');

        // Attempt 1 in Org B -> SUCCEEDS (No cross-client leakage)
        const resB1 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgB.id,
            lei: testLei
        });
        expect(resB1.success).toBe(true);
    });

    it('6. Blocks Admin restore when another current dossier exists for the same Org + LegalEntity', async () => {
        const resA1 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        const leA1 = resA1.data;

        // Soft-delete A1
        await deleteClientLE(leA1.id);

        // Create fresh current dossier A2
        const resA2 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        expect(resA2.success).toBe(true);
        const leA2 = resA2.data;

        // Admin attempt to restore A1 while A2 is current -> BLOCKED
        await expect(restoreClientLECore(leA1.id)).rejects.toThrow('already has a current dossier');

        // Delete current dossier A2
        await deleteClientLE(leA2.id);

        // Admin restore A1 now -> SUCCEEDS
        const restoredA1 = await restoreClientLECore(leA1.id);
        expect(restoredA1.isDeleted).toBe(false);
    });

    it('7. Verifies status semantics: SUSPENDED occupies current slot; ARCHIVED relinquishes it', async () => {
        const resA1 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        const leA1 = resA1.data;

        // Set A1 status to SUSPENDED
        await prisma.clientLE.update({
            where: { id: leA1.id },
            data: { status: 'SUSPENDED' }
        });

        // Attempt creation while A1 is SUSPENDED -> BLOCKED
        const resA2 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        expect(resA2.success).toBe(false);
        expect(resA2.error).toContain('already exists in your organisation');

        // Set A1 status to ARCHIVED
        await prisma.clientLE.update({
            where: { id: leA1.id },
            data: { status: 'ARCHIVED' }
        });

        // Attempt creation while A1 is ARCHIVED -> SUCCEEDS (ARCHIVED relinquishes current slot)
        const resA3 = await createClientLE({
            name: 'Fusion UK Finco',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        expect(resA3.success).toBe(true);
    });

    it('8. Soft-delete changes only deletion state; restore preserves pre-delete operational status (ACTIVE, SUSPENDED, ARCHIVED)', async () => {
        // ACTIVE -> delete -> restore retains ACTIVE
        const res1 = await createClientLE({
            name: 'Status Test ACTIVE',
            jurisdiction: 'GB',
            explicitOrgId: orgA.id,
            lei: testLei
        });
        const le1 = res1.data!;
        expect(le1.status).toBe('ACTIVE');
        await deleteClientLE(le1.id);
        const restored1 = await restoreClientLECore(le1.id);
        expect(restored1.status).toBe('ACTIVE');
        expect(restored1.isDeleted).toBe(false);

        // SUSPENDED -> delete -> restore retains SUSPENDED
        await prisma.clientLE.update({ where: { id: le1.id }, data: { status: 'SUSPENDED' } });
        await deleteClientLE(le1.id);
        const restored2 = await restoreClientLECore(le1.id);
        expect(restored2.status).toBe('SUSPENDED');
        expect(restored2.isDeleted).toBe(false);

        // ARCHIVED -> delete -> restore retains ARCHIVED
        await prisma.clientLE.update({ where: { id: le1.id }, data: { status: 'ARCHIVED' } });
        await deleteClientLE(le1.id);
        const restored3 = await restoreClientLECore(le1.id);
        expect(restored3.status).toBe('ARCHIVED');
        expect(restored3.isDeleted).toBe(false);
    });

    it('9. Concurrency test: near-simultaneous duplicate creation requests cannot produce multiple CURRENT dossiers', async () => {
        // Run 3 parallel creation requests for the exact same Org + LEI
        const parallelRequests = Array.from({ length: 3 }).map(() =>
            createClientLE({
                name: 'Concurrency Race LE',
                jurisdiction: 'GB',
                explicitOrgId: orgA.id,
                lei: testLei
            })
        );

        const results = await Promise.all(parallelRequests);
        const successes = results.filter(r => r.success);
        const failures = results.filter(r => !r.success);

        // Exactly 1 request must succeed; 2 must be rejected with duplicate error
        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(2);
        failures.forEach(f => {
            expect(f.error).toContain('already exists in your organisation');
        });
    });
});

