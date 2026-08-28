import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveMasterFieldNote } from '../master-data-notes';
import { addFieldAttachment, replaceFieldAttachment, removeFieldAttachment } from '../attachment-actions';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getIdentity: vi.fn(),
}));

vi.mock('@/lib/auth/actor-context', () => ({
  getActorContext: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

vi.mock('@/lib/auth/permissions', () => ({
  Action: { LE_EDIT_MASTER_DATA: 'LE_EDIT_MASTER_DATA' },
  can: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
  FieldClaimService: {
    addAttachment: vi.fn(),
    replaceAttachment: vi.fn(),
    removeAttachment: vi.fn(),
  },
}));

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $executeRaw: vi.fn(),
    clientLE: {
      findUnique: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}));

describe('Notes and Attachments Error Boundary Tests (ONP-6)', () => {
  const originalEnv = process.env.APP_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_ENV; // Deployed env (fails closed)
    // Default mocks
    vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-123' } as any);
    mockPrisma.clientLE.findUnique.mockResolvedValue({ id: 'le-1', legalEntityId: 'leg-1' });
  });

  afterEach(() => {
    process.env.APP_ENV = originalEnv;
  });

  describe('saveMasterFieldNote', () => {
    it('returns kind: domain for expected unauthorized failure', async () => {
      vi.mocked(getIdentity).mockResolvedValueOnce(null as any);

      const result = await saveMasterFieldNote('le-1', 1, 'Test note');

      expect(result.success).toBe(false);
      expect((result as any).kind).toBe('domain');
      expect((result as any).message).toBe('Unauthorized');
      expect((result as any).errorRef).toBeUndefined();
    });

    it('sanitizes raw SQL/DB exception into unexpected failure with errorRef', async () => {
      mockPrisma.$executeRaw.mockRejectedValueOnce(
        new Error('SQLSTATE 22021: invalid byte sequence for encoding "UTF8": 0x00 in INSERT INTO master_field_notes')
      );

      const result = await saveMasterFieldNote('le-1', 1, 'Bad\0note');

      expect(result.success).toBe(false);
      expect((result as any).kind).toBe('unexpected');
      expect((result as any).message).toBe('We couldn’t save this note.');
      expect((result as any).errorRef).toMatch(/^ERR-[0-9A-F]{12}$/);
      expect((result as any).technicalDetails).toBeUndefined();
      expect((result as any).message).not.toContain('SQLSTATE');
      expect((result as any).message).not.toContain('0x00');
    });
  });

  describe('Master Attachment Actions', () => {
    it('addFieldAttachment returns success contract on valid upload', async () => {
      const mockClaim = { id: 'claim-att-1', fieldNo: 10, clientLEId: 'le-1' };
      vi.mocked(FieldClaimService.addAttachment).mockResolvedValueOnce(mockClaim as any);

      const result = await addFieldAttachment({
        clientLEId: 'le-1',
        fieldNo: 10,
        attachmentDocumentId: 'doc-100',
      });

      expect(result.success).toBe(true);
      expect((result as any).claim).toEqual(mockClaim);
    });

    it('addFieldAttachment sanitizes DB exceptions into unexpected failure with errorRef', async () => {
      vi.mocked(FieldClaimService.addAttachment).mockRejectedValueOnce(
        new Error('PrismaClientKnownRequestError: Foreign key constraint failed on attachmentDocumentId')
      );

      const result = await addFieldAttachment({
        clientLEId: 'le-1',
        fieldNo: 10,
        attachmentDocumentId: 'doc-invalid',
      });

      expect(result.success).toBe(false);
      expect((result as any).kind).toBe('unexpected');
      expect((result as any).message).toBe('We couldn’t add this attachment.');
      expect((result as any).errorRef).toMatch(/^ERR-[0-9A-F]{12}$/);
      expect((result as any).technicalDetails).toBeUndefined();
      expect((result as any).message).not.toContain('PrismaClientKnownRequestError');
    });

    it('replaceFieldAttachment sanitizes DB exceptions into unexpected failure with errorRef', async () => {
      vi.mocked(FieldClaimService.replaceAttachment).mockRejectedValueOnce(
        new Error('PrismaClientKnownRequestError: Record to update not found.')
      );

      const result = await replaceFieldAttachment({
        clientLEId: 'le-1',
        fieldNo: 10,
        instanceId: 'inst-1',
        attachmentDocumentId: 'doc-101',
      });

      expect(result.success).toBe(false);
      expect((result as any).kind).toBe('unexpected');
      expect((result as any).message).toBe('We couldn’t replace this attachment.');
      expect((result as any).errorRef).toMatch(/^ERR-[0-9A-F]{12}$/);
      expect((result as any).technicalDetails).toBeUndefined();
    });

    it('removeFieldAttachment sanitizes DB exceptions into unexpected failure with errorRef', async () => {
      vi.mocked(FieldClaimService.removeAttachment).mockRejectedValueOnce(
        new Error('PrismaClientUnknownRequestError: Database connection lost during tombstone creation')
      );

      const result = await removeFieldAttachment({
        clientLEId: 'le-1',
        fieldNo: 10,
        instanceId: 'inst-1',
      });

      expect(result.success).toBe(false);
      expect((result as any).kind).toBe('unexpected');
      expect((result as any).message).toBe('We couldn’t remove this attachment.');
      expect((result as any).errorRef).toMatch(/^ERR-[0-9A-F]{12}$/);
      expect((result as any).technicalDetails).toBeUndefined();
    });
  });
});
