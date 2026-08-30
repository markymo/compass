import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import prisma from '@/lib/prisma';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { resolveAmalgamatedAttachments } from '@/lib/kyc/attachments';
import { ClaimStatus, SourceType } from '@prisma/client';
import { assertUatDbTestEnv } from './test-env-guard';

// Mock Auth
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({
        userId: 'usr-onp49-test',
        email: 'test@onpro.tech'
    })
}));

describe('ONP-49 — Attachment Write Policy & Historic Evidence Preservation Contract', () => {
    const clientLEId = 'le-onp49-test';
    const subjectLeId = 'legal-entity-onp49';
    const fieldNo = 39; // Register of members location

    beforeAll(() => {
        assertUatDbTestEnv();
    });

    afterAll(async () => {
        await prisma.fieldClaim.deleteMany({ where: { clientLEId } });
        await prisma.document.deleteMany({ where: { id: { in: ['doc-historic-1', 'doc-future-2'] } } });
        await prisma.clientLE.deleteMany({ where: { id: clientLEId } });
        await prisma.legalEntity.deleteMany({ where: { id: subjectLeId } });
        await prisma.user.deleteMany({ where: { email: 'test-onp49@onpro.tech' } });
    });

    beforeEach(async () => {
        // Clean up test data
        await prisma.fieldClaim.deleteMany({
            where: { clientLEId }
        });
        await prisma.document.deleteMany({
            where: { id: { in: ['doc-historic-1', 'doc-future-2'] } }
        });
        await prisma.clientLE.deleteMany({
            where: { id: clientLEId }
        });
        await prisma.legalEntity.deleteMany({
            where: { id: subjectLeId }
        });
        await prisma.user.deleteMany({
            where: { email: 'test-onp49@onpro.tech' }
        });

        // Setup base User, LE, and ClientLE
        await prisma.user.create({
            data: {
                id: 'usr-onp49-test',
                email: 'test-onp49@onpro.tech',
                name: 'Compliance Officer'
            }
        });
        await prisma.legalEntity.create({
            data: {
                id: subjectLeId,
                name: 'Test Firm LE',
                reference: 'REF-ONP49'
            }
        });
        await prisma.clientLE.create({
            data: {
                id: clientLEId,
                legalEntityId: subjectLeId,
                name: 'Test Firm Client LE'
            }
        });

        // Setup document records
        await prisma.document.create({
            data: {
                id: 'doc-historic-1',
                name: 'historic-register-extract.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 10240,
                storagePathname: 'test/historic-register-extract.pdf',
                uploadedBy: { connect: { id: 'usr-onp49-test' } }
            }
        });
    });

    it('Enforces prospective write policy while preserving historic evidence when allowAttachments changes to false', async () => {
        // Step 1: Field allows attachments -> create historic attachment claim
        const historicClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                fieldNo,
                claimRole: 'FILE_ATTACHMENT',
                status: ClaimStatus.VERIFIED,
                sourceType: SourceType.USER_INPUT,
                sourceReference: 'Uploaded during initial KYC review',
                attachmentDocumentId: 'doc-historic-1',
                instanceId: 'inst-att-1',
                assertedAt: new Date('2026-08-01T10:00:00Z'),
                verifiedByUserId: 'usr-onp49-test'
            }
        });
        expect(historicClaim.id).toBeDefined();

        // Step 2: Query attachments when allowAttachments = true
        const fieldDefsMapAllowed = new Map([[fieldNo, { allowAttachments: true }]]);
        const attachmentsMapAllowed = await resolveAmalgamatedAttachments(
            { clientLEId, subjectLeId },
            [fieldNo],
            new Map(),
            fieldDefsMapAllowed
        );
        const resolvedAllowed = attachmentsMapAllowed.get(fieldNo);
        expect(resolvedAllowed).toBeDefined();
        expect(resolvedAllowed?.length).toBe(1);
        expect(resolvedAllowed?.[0].documentId).toBe('doc-historic-1');
        expect(resolvedAllowed?.[0].displayName).toBe('historic-register-extract.pdf');

        // Step 3: Change configuration to allowAttachments = false
        const fieldDefsMapDisabled = new Map([[fieldNo, { allowAttachments: false }]]);

        // Step 4: Prospective write enforcement:
        // Attempting to add a new attachment when allowAttachments = false must throw
        await expect(
            FieldClaimService.assertClaim({
                clientLEId,
                subjectLeId,
                fieldNo,
                claimRole: 'FILE_ATTACHMENT',
                sourceType: SourceType.USER_INPUT,
                attachmentDocumentId: 'doc-future-2',
                instanceId: 'inst-att-2'
            })
        ).rejects.toThrow(/Attachments are not permitted for this field/i);

        // Step 5: Historic preservation:
        // Resolving attachments with allowAttachments = false MUST STILL return historic evidence
        const attachmentsMapDisabled = await resolveAmalgamatedAttachments(
            { clientLEId, subjectLeId },
            [fieldNo],
            new Map(),
            fieldDefsMapDisabled
        );
        const resolvedDisabled = attachmentsMapDisabled.get(fieldNo);
        expect(resolvedDisabled).toBeDefined();
        expect(resolvedDisabled?.length).toBe(1);
        expect(resolvedDisabled?.[0].documentId).toBe('doc-historic-1');
        expect(resolvedDisabled?.[0].displayName).toBe('historic-register-extract.pdf');
    });
});
