import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { updateFieldManually } from '@/actions/kyc-manual-update';
import { resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';
import { ClaimStatus, SourceType } from '@prisma/client';

// Mock Auth
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({
        userId: 'usr-test-123',
        orgId: 'org-test-123',
        email: 'test@onpro.tech'
    })
}));

// Mock Next Cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn()
}));

describe('ONP-95 — Master Edit Claim Precedence, Hydration & Immutability Contracts', () => {
    const clientLEId = 'le-onp95-test';
    const subjectLeId = 'legal-entity-onp95';
    const fieldNo = 45; // Fund manager (TEXT)

    beforeEach(async () => {
        // Clean up test data
        await prisma.fieldClaim.deleteMany({
            where: { clientLEId }
        });
        await prisma.clientLE.deleteMany({
            where: { id: clientLEId }
        });
        await prisma.legalEntity.deleteMany({
            where: { id: subjectLeId }
        });
        await prisma.user.deleteMany({
            where: { id: 'usr-test-123' }
        });

        // Setup base User
        await prisma.user.create({
            data: {
                id: 'usr-test-123',
                email: 'test@onpro.tech',
                name: 'Test User'
            }
        });

        // Setup base ClientLE
        await prisma.legalEntity.create({
            data: {
                id: subjectLeId,
                name: 'Test Fund LE',
                reference: 'REF-ONP95'
            }
        });
        await prisma.clientLE.create({
            data: {
                id: clientLEId,
                legalEntityId: subjectLeId,
                name: 'Test Fund Client LE'
            }
        });
    });

    it('Case A — Superseded None: older explicitNone claim is superseded by newer claim, read-only and edit use newer value', async () => {
        // 1. Older claim: explicitNone
        const olderClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo,
                claimRole: 'VALUE',
                status: ClaimStatus.VERIFIED,
                sourceType: SourceType.USER_INPUT,
                valueJson: { explicitNone: true },
                assertedAt: new Date('2026-08-01T10:00:00Z')
            }
        });

        // 2. Newer claim: actual fund manager
        const newerClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo,
                claimRole: 'VALUE',
                status: ClaimStatus.VERIFIED,
                sourceType: SourceType.USER_INPUT,
                valueText: 'BlackRock Advisors UK',
                assertedAt: new Date('2026-08-15T12:00:00Z')
            }
        });

        // 3. KycStateService resolution
        const authoritative = await KycStateService.getAuthoritativeValue(
            { clientLEId, subjectLeId },
            fieldNo
        );
        expect(authoritative).not.toBeNull();
        expect(authoritative?.claimId).toBe(newerClaim.id);
        expect(authoritative?.value).toBe('BlackRock Advisors UK');

        // 4. Canonical Display Model resolution
        const canonical = resolveFieldForDisplay(authoritative?.value, null, {
            fieldNo,
            label: 'Fund manager',
            appDataType: 'TEXT'
        });
        expect(canonical.state).toBe('POPULATED');
        expect(canonical.value).toEqual({
            kind: 'scalar',
            display: 'BlackRock Advisors UK',
            rawValue: 'BlackRock Advisors UK'
        });

        // 5. Edit-mode hydration semantic contract:
        // Must hydrate from canonical.value.rawValue ("BlackRock Advisors UK"), NOT older explicitNone claim
        const editInitialValue = canonical.value.kind === 'scalar' ? canonical.value.rawValue : '';
        expect(editInitialValue).toBe('BlackRock Advisors UK');
        expect(editInitialValue).not.toContain('explicitNone');
    });

    it('Case B — Authoritative explicitNone: read-only displays semantic None, edit hydrates empty string, save creates new USER_INPUT claim while preserving history', async () => {
        // 1. Authoritative explicitNone claim
        const noneClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo,
                claimRole: 'VALUE',
                status: ClaimStatus.VERIFIED,
                sourceType: SourceType.USER_INPUT,
                valueJson: { explicitNone: true },
                assertedAt: new Date('2026-08-20T10:00:00Z')
            }
        });

        // 2. Resolver produces explicitNone derived value
        const authoritative = await KycStateService.getAuthoritativeValue(
            { clientLEId, subjectLeId },
            fieldNo
        );
        expect(authoritative).not.toBeNull();
        expect(authoritative?.claimId).toBe(noneClaim.id);
        expect(authoritative?.value).toEqual({ explicitNone: true });

        // 3. Canonical Display Model resolves to EXPLICIT_NONE state with kind: 'empty'
        const canonical = resolveFieldForDisplay(authoritative?.value, null, {
            fieldNo,
            label: 'Fund manager',
            appDataType: 'TEXT'
        });
        expect(canonical.state).toBe('EXPLICIT_NONE');
        expect(canonical.value).toEqual({ kind: 'empty' });

        // 4. Edit-mode hydration semantic contract:
        // EXPLICIT_NONE state resolves to clean empty string for form inputs (never raw JSON sentinel)
        const editInitialValue = (canonical.state === 'EXPLICIT_NONE' || canonical.value.kind === 'empty') ? '' : (canonical.value as any).rawValue;
        expect(editInitialValue).toBe('');

        // 5. Saving a new value via updateFieldManually creates a brand NEW FieldClaim
        const saveRes = await updateFieldManually(clientLEId, fieldNo, 'Schroders Investment Management', 'User override');
        expect(saveRes.success).toBe(true);

        // 6. Immutability verification:
        // The original explicitNone claim is UNCHANGED in history
        const originalClaimInDb = await prisma.fieldClaim.findUnique({
            where: { id: noneClaim.id }
        });
        expect(originalClaimInDb).not.toBeNull();
        expect(originalClaimInDb?.valueJson).toEqual({ explicitNone: true });

        // A new USER_INPUT claim exists in DB
        const allClaims = await prisma.fieldClaim.findMany({
            where: { clientLEId, fieldNo },
            orderBy: { assertedAt: 'asc' }
        });
        expect(allClaims.length).toBe(2);
        expect(allClaims[0].id).toBe(noneClaim.id);
        expect(allClaims[1].sourceType).toBe('USER_INPUT');
        expect(allClaims[1].valueText).toBe('Schroders Investment Management');

        // New authoritative winner is now the new claim
        const updatedAuthoritative = await KycStateService.getAuthoritativeValue(
            { clientLEId, subjectLeId },
            fieldNo
        );
        expect(updatedAuthoritative?.value).toBe('Schroders Investment Management');
        expect(updatedAuthoritative?.claimId).toBe(allClaims[1].id);
    });

    it('Case C — Normal edit: editing existing authoritative scalar creates a new USER_INPUT claim while prior claims remain unchanged', async () => {
        // 1. Initial registry/source claim
        const initialClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo,
                claimRole: 'VALUE',
                status: ClaimStatus.VERIFIED,
                sourceType: SourceType.COMPANIES_HOUSE,
                sourceReference: 'CH-001',
                valueText: 'Old Asset Management Ltd',
                assertedAt: new Date('2026-08-01T10:00:00Z')
            }
        });

        // 2. User edits the value
        const saveRes = await updateFieldManually(clientLEId, fieldNo, 'Updated Asset Management Ltd', 'Manual correction');
        expect(saveRes.success).toBe(true);

        // 3. Immutability verification:
        const claimsInDb = await prisma.fieldClaim.findMany({
            where: { clientLEId, fieldNo },
            orderBy: { assertedAt: 'asc' }
        });
        expect(claimsInDb.length).toBe(2);

        // Prior claim unchanged
        expect(claimsInDb[0].id).toBe(initialClaim.id);
        expect(claimsInDb[0].sourceType).toBe('COMPANIES_HOUSE');
        expect(claimsInDb[0].valueText).toBe('Old Asset Management Ltd');

        // New claim is USER_INPUT
        expect(claimsInDb[1].sourceType).toBe('USER_INPUT');
        expect(claimsInDb[1].valueText).toBe('Updated Asset Management Ltd');

        // Authoritative resolution picks the newer USER_INPUT override
        const authoritative = await KycStateService.getAuthoritativeValue(
            { clientLEId, subjectLeId },
            fieldNo
        );
        expect(authoritative?.value).toBe('Updated Asset Management Ltd');
        expect(authoritative?.claimId).toBe(claimsInDb[1].id);
    });
});
