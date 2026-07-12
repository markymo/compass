import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { SourceType } from '@prisma/client';

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService');

import prismaMock from '@/lib/__mocks__/prisma';
import * as definitionService from '@/services/masterData/definitionService';

describe('FieldClaimService Attachment Writes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock validateValueSlot by mocking field definition
        (definitionService.getMasterFieldDefinition as any).mockResolvedValue({
            fieldNo: 999,
            logicalType: 'FILE',
            multiplicity: 'MANY'
        });
        
        // Mock document exists
        (prismaMock.document.findUnique as any).mockResolvedValue({ id: 'valid-doc', clientLEId: 'client-1' });
        
        // Mock claim create
        (prismaMock.fieldClaim.create as any).mockImplementation(async (args: any) => ({
            id: 'new-claim-id',
            ...args.data
        }));
    });

    describe('addAttachment', () => {
        it('validates document exists and creates a new attachment instance', async () => {
            const subject = { subjectLeId: 'le-123', clientLEId: 'client-1' };
            const result = await FieldClaimService.addAttachment(subject, 999, 'valid-doc', null);
            
            expect(prismaMock.document.findUnique).toHaveBeenCalledWith({ where: { id: 'valid-doc' } });
            expect(prismaMock.fieldClaim.create).toHaveBeenCalled();
            expect(result.instanceId).toBeDefined();
            expect(result.attachmentDocumentId).toBe('valid-doc');
            expect(result.claimRole).toBe('FILE_ATTACHMENT');
        });

        it('rejects if document does not exist', async () => {
            (prismaMock.document.findUnique as any).mockResolvedValue(null);
            const subject = { subjectLeId: 'le-123', clientLEId: 'client-1' };
            await expect(FieldClaimService.addAttachment(subject, 999, 'invalid-doc', null))
                .rejects.toThrow(/not found/);
        });

        it('rejects if document belongs to another clientLE', async () => {
            (prismaMock.document.findUnique as any).mockResolvedValue({ id: 'valid-doc', clientLEId: 'other-client' });
            const subject = { subjectLeId: 'le-123', clientLEId: 'client-1' };
            await expect(FieldClaimService.addAttachment(subject, 999, 'valid-doc', null))
                .rejects.toThrow(/does not belong to the requested clientLE/);
        });
    });

    describe('replaceAttachment', () => {
        it('validates document exists, verifies instance scope, and appends a claim', async () => {
            const subject = { subjectLeId: 'le-123', clientLEId: 'client-1' };
            (prismaMock.fieldClaim.findMany as any).mockResolvedValue([{ instanceId: 'inst-1' }]);
            
            const result = await FieldClaimService.replaceAttachment(subject, 999, 'inst-1', 'valid-doc', null);
            
            expect(prismaMock.fieldClaim.findMany).toHaveBeenCalled();
            expect(prismaMock.document.findUnique).toHaveBeenCalled();
            expect(result.instanceId).toBe('inst-1');
            expect(result.attachmentDocumentId).toBe('valid-doc');
        });

        it('rejects if attachment instance is not found in requested scope', async () => {
            (prismaMock.fieldClaim.findMany as any).mockResolvedValue([]);
            const subject = { subjectLeId: 'le-123' };
            await expect(FieldClaimService.replaceAttachment(subject, 999, 'inst-1', 'valid-doc', null))
                .rejects.toThrow(/not found or does not belong to the requested scope/);
        });

        it('rejects if attachment instance has already been removed (tombstoned)', async () => {
            (prismaMock.fieldClaim.findMany as any).mockResolvedValue([{ instanceId: 'inst-1', valueJson: { tombstone: true } }]);
            const subject = { subjectLeId: 'le-123' };
            await expect(FieldClaimService.replaceAttachment(subject, 999, 'inst-1', 'valid-doc', null))
                .rejects.toThrow(/has already been removed/);
        });
    });

    describe('removeAttachment', () => {
        it('verifies instance scope and appends a tombstone claim', async () => {
            const subject = { subjectLeId: 'le-123' };
            (prismaMock.fieldClaim.findMany as any).mockResolvedValue([{ instanceId: 'inst-1' }]);
            
            const result = await FieldClaimService.removeAttachment(subject, 999, 'inst-1', null);
            
            expect(prismaMock.fieldClaim.findMany).toHaveBeenCalled();
            expect(result.instanceId).toBe('inst-1');
            expect(result.attachmentDocumentId).toBeUndefined(); // It should be null, which comes out as undefined in input
            expect(result.valueJson).toEqual({ tombstone: true });
        });

        it('rejects cross-field/cross-subject removal', async () => {
            // Simulated by findMany returning empty array since scope didn't match
            (prismaMock.fieldClaim.findMany as any).mockResolvedValue([]);
            const subject = { subjectLeId: 'other-le' };
            await expect(FieldClaimService.removeAttachment(subject, 999, 'inst-1', null))
                .rejects.toThrow(/not found or does not belong to the requested scope/);
        });
    });

    describe('assertClaim payload invariants', () => {
        it('enforces active FILE_ATTACHMENT must have attachmentDocumentId', async () => {
            await expect(FieldClaimService.assertClaim({
                fieldNo: 999, subjectLeId: 'le-123', sourceType: SourceType.USER_INPUT,
                claimRole: 'FILE_ATTACHMENT',
                // missing attachmentDocumentId
            })).rejects.toThrow(/Active FILE_ATTACHMENT claim must have attachmentDocumentId/);
        });

        it('enforces FILE_ATTACHMENT must not populate scalar values', async () => {
            await expect(FieldClaimService.assertClaim({
                fieldNo: 999, subjectLeId: 'le-123', sourceType: SourceType.USER_INPUT,
                claimRole: 'FILE_ATTACHMENT',
                attachmentDocumentId: 'valid-doc',
                valueText: 'not allowed'
            })).rejects.toThrow(/FILE_ATTACHMENT claim must not populate scalar values/);
        });

        it('enforces FILE_ATTACHMENT tombstone must not have attachmentDocumentId', async () => {
            await expect(FieldClaimService.assertClaim({
                fieldNo: 999, subjectLeId: 'le-123', sourceType: SourceType.USER_INPUT,
                claimRole: 'FILE_ATTACHMENT',
                attachmentDocumentId: 'valid-doc',
                valueJson: { tombstone: true }
            })).rejects.toThrow(/FILE_ATTACHMENT tombstone must not have attachmentDocumentId/);
        });

        it('enforces VALUE claim must not populate attachmentDocumentId', async () => {
            await expect(FieldClaimService.assertClaim({
                fieldNo: 999, subjectLeId: 'le-123', sourceType: SourceType.USER_INPUT,
                claimRole: 'VALUE',
                valueText: 'test',
                attachmentDocumentId: 'valid-doc'
            })).rejects.toThrow(/VALUE claim must not populate attachmentDocumentId/);
        });
    });
});
