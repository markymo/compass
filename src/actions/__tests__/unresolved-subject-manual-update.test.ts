import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateFieldManually, addMultiValueEntry, removeMultiValueEntry, clearSingleValueEntry } from '../kyc-manual-update';
import { addFieldAttachment, removeFieldAttachment } from '../attachment-actions';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { getFieldDetail, resolveMasterData } from '../kyc-query';
import prisma from '@/lib/prisma';

// Mock dependencies requiring identity/auth
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-test-onp5' })
}));

vi.mock('@/lib/auth/actor-context', () => ({
    getActorContext: vi.fn().mockResolvedValue({ userId: 'user-test-onp5' })
}));

vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockResolvedValue(true),
    Action: { LE_EDIT_MASTER_DATA: 'LE_EDIT_MASTER_DATA' }
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

describe('Unresolved LegalEntity Subject (ONP-5) Regression & Architecture Tests', () => {

    beforeEach(async () => {
        // Ensure test user exists in DB for foreign key relations
        await prisma.user.upsert({
            where: { id: 'user-test-onp5' },
            update: {},
            create: {
                id: 'user-test-onp5',
                email: 'test-onp5@example.com',
                name: 'ONP5 Test User'
            }
        });
    });

    describe('1. FieldClaimService Subject Invariants', () => {
        it('should allow claim assertion with clientLEId and subjectLeId = null', async () => {
            const cle = await prisma.clientLE.create({
                data: { name: 'Invariant Test ClientLE', legalEntityId: null }
            });

            const claim = await FieldClaimService.assertClaim({
                fieldNo: 3,
                clientLEId: cle.id,
                subjectLeId: undefined,
                valueText: 'Test Company Ltd',
                sourceType: 'USER_INPUT' as any
            });

            expect(claim).toBeDefined();
            expect(claim.clientLEId).toBe(cle.id);
            expect(claim.subjectLeId).toBeNull();
        });

        it('should reject claim assertion with >1 canonical subjects', async () => {
            await expect(FieldClaimService.assertClaim({
                fieldNo: 3,
                clientLEId: 'cle-unresolved-1',
                subjectLeId: 'le-123',
                subjectPersonId: 'person-123',
                valueText: 'Test Company Ltd',
                sourceType: 'USER_INPUT' as any
            })).rejects.toThrow('FieldClaim cannot have multiple canonical subjects');
        });

        it('should reject claim assertion when neither clientLEId nor any subject FK is provided', async () => {
            await expect(FieldClaimService.assertClaim({
                fieldNo: 3,
                valueText: 'Test Company Ltd',
                sourceType: 'USER_INPUT' as any
            })).rejects.toThrow('FieldClaim assertion requires clientLEId or a subject');
        });
    });

    describe('2. Unresolved ClientLE Dossier Write & Read Lifecycle', () => {
        let unresolvedClientLEId: string;

        beforeEach(async () => {
            // Create a ClientLE with NO LegalEntity subject (legalEntityId = null)
            const cle = await prisma.clientLE.create({
                data: {
                    name: 'Unresolved ClientLE Dossier',
                    legalEntityId: null,
                }
            });
            unresolvedClientLEId = cle.id;
        });

        it('should allow manual single-value update when legalEntityId is null', async () => {
            const updateResult = await updateFieldManually(
                unresolvedClientLEId,
                3, // Field 3: Legal Name
                'Unresolved Legal Name Ltd',
                'Manual entry on un-enriched dossier'
            );

            expect(updateResult.success).toBe(true);
            expect(updateResult.claimId).toBeDefined();

            // Verify FieldClaim persisted with clientLEId set and subjectLeId = null
            const claim = await prisma.fieldClaim.findUnique({
                where: { id: updateResult.claimId! }
            });
            expect(claim).toBeDefined();
            expect(claim?.clientLEId).toBe(unresolvedClientLEId);
            expect(claim?.subjectLeId).toBeNull();

            // Read back field detail and verify no error messages returned
            const detail = await getFieldDetail(unresolvedClientLEId, 3, 'CLIENT_LE');
            expect(detail.notes ?? '').not.toContain('LegalEntity subject missing');
            expect(detail.current?.value).toBe('Unresolved Legal Name Ltd');
            expect(detail.history.length).toBeGreaterThan(0);
        });

        it('should allow multi-value entry and removal when legalEntityId is null', async () => {
            // Field 4: Trading Names (Multi-value TEXT)
            const addResult = await addMultiValueEntry(
                unresolvedClientLEId,
                4,
                'Trading Name 1'
            );
            expect(addResult.success).toBe(true);

            // Read back via resolveMasterData
            const res = await resolveMasterData(unresolvedClientLEId, [
                { questionId: 'q4', masterFieldNo: 4 }
            ]);
            expect(res.q4).toBeDefined();
            expect(res.q4[4]).toBeDefined();

            // Remove entry
            const activeClaims = await prisma.fieldClaim.findMany({
                where: { clientLEId: unresolvedClientLEId, fieldNo: 4 }
            });
            expect(activeClaims.length).toBe(1);

            const removeResult = await removeMultiValueEntry(
                unresolvedClientLEId,
                4,
                activeClaims[0].id
            );
            expect(removeResult.success).toBe(true);
        });

        it('should allow single-value clear via tombstone when legalEntityId is null', async () => {
            await updateFieldManually(unresolvedClientLEId, 3, 'Temp Name', 'Init');
            const clearResult = await clearSingleValueEntry(unresolvedClientLEId, 3);
            expect(clearResult.success).toBe(true);

            const detail = await getFieldDetail(unresolvedClientLEId, 3, 'CLIENT_LE');
            expect(detail.notes ?? '').not.toContain('LegalEntity subject missing');
        });

        it('should allow adding and removing field attachments when legalEntityId is null', async () => {
            // Create a Document record tied to unresolvedClientLEId
            const doc = await prisma.document.create({
                data: {
                    name: 'test-document.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: BigInt(1024),
                    clientLEId: unresolvedClientLEId
                }
            });

            const addAttResult = await addFieldAttachment({
                clientLEId: unresolvedClientLEId,
                fieldNo: 999,
                attachmentDocumentId: doc.id
            });
            expect(addAttResult.id).toBeDefined();

            const detail = await getFieldDetail(unresolvedClientLEId, 999, 'CLIENT_LE');
            expect(detail.notes ?? '').not.toContain('LegalEntity subject missing');

            const removeAttResult = await removeFieldAttachment({
                clientLEId: unresolvedClientLEId,
                fieldNo: 999,
                instanceId: addAttResult.instanceId!
            });
            expect(removeAttResult.id).toBeDefined();
        });
    });

    describe('3. Cross-Client Dossier Isolation (Security Boundary)', () => {
        it('should isolate manual claims between two ClientLEs sharing the same LegalEntity', async () => {
            const canonicalLE = await prisma.legalEntity.create({
                data: { name: 'Shared Canonical LegalEntity XYZ', reference: `LE-REF-${Date.now()}-1` }
            });

            const cleA = await prisma.clientLE.create({
                data: { name: 'ClientLE A (Shared LE)', legalEntityId: canonicalLE.id }
            });
            const cleB = await prisma.clientLE.create({
                data: { name: 'ClientLE B (Shared LE)', legalEntityId: canonicalLE.id }
            });

            // Write manual claim to ClientLE A
            await updateFieldManually(cleA.id, 3, 'Name Asserted on A', 'Dossier A update');

            // Verify claim is visible in ClientLE A
            const detailA = await getFieldDetail(cleA.id, 3, 'CLIENT_LE');
            expect(detailA.current?.value).toBe('Name Asserted on A');

            // CRITICAL INVARIANT: Claim on A MUST NOT be visible in ClientLE B
            const detailB = await getFieldDetail(cleB.id, 3, 'CLIENT_LE');
            expect(detailB.current).toBeNull();
            expect(detailB.history).toHaveLength(0);
        });

        it('should isolate manual claims between two unresolved ClientLEs (both legalEntityId = null)', async () => {
            const cleC = await prisma.clientLE.create({
                data: { name: 'ClientLE C (Unresolved)', legalEntityId: null }
            });
            const cleD = await prisma.clientLE.create({
                data: { name: 'ClientLE D (Unresolved)', legalEntityId: null }
            });

            // Write manual claim to ClientLE C
            await updateFieldManually(cleC.id, 3, 'Name Asserted on C', 'Dossier C update');

            // Verify claim is visible in ClientLE C
            const detailC = await getFieldDetail(cleC.id, 3, 'CLIENT_LE');
            expect(detailC.current?.value).toBe('Name Asserted on C');

            // CRITICAL INVARIANT: Claim on C MUST NOT be visible in ClientLE D
            const detailD = await getFieldDetail(cleD.id, 3, 'CLIENT_LE');
            expect(detailD.current).toBeNull();
            expect(detailD.history).toHaveLength(0);
        });
    });

    describe('4. Unresolved -> Resolved Lifecycle (No Backfill Invariant)', () => {
        it('should resolve pre-existing dossier claims cleanly after ClientLE is subsequently mapped to a LegalEntity without requiring backfill', async () => {
            // 1. Create unresolved ClientLE
            const cle = await prisma.clientLE.create({
                data: { name: 'Initially Unresolved ClientLE', legalEntityId: null }
            });

            // 2. Assert manual claim (persisted with subjectLeId = null)
            const saveRes = await updateFieldManually(cle.id, 3, 'Pre-resolution Name Ltd', 'Dossier note');
            expect(saveRes.success).toBe(true);

            const initialClaim = await prisma.fieldClaim.findUnique({
                where: { id: saveRes.claimId! }
            });
            expect(initialClaim?.subjectLeId).toBeNull();

            // 3. Subsequently resolve/bind the ClientLE to a canonical LegalEntity
            const canonicalLE = await prisma.legalEntity.create({
                data: { name: 'Canonical LegalEntity ABC', reference: `LE-REF-${Date.now()}-2` }
            });
            await prisma.clientLE.update({
                where: { id: cle.id },
                data: { legalEntityId: canonicalLE.id }
            });

            // 4. Verify original claim subjectLeId was NOT backfilled (remains null)
            const claimAfterBinding = await prisma.fieldClaim.findUnique({
                where: { id: saveRes.claimId! }
            });
            expect(claimAfterBinding?.subjectLeId).toBeNull();

            // 5. Verify the pre-existing claim continues to resolve correctly on the resolved ClientLE
            const detail = await getFieldDetail(cle.id, 3, 'CLIENT_LE');
            expect(detail.current?.value).toBe('Pre-resolution Name Ltd');
            expect(detail.history).toHaveLength(1);
        });
    });
});
