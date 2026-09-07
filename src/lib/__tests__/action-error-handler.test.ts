import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ActionDomainError,
  handleActionError,
  generateHighEntropyErrorRef,
  sanitizeDiagnosticContext,
  isLocalhostServerEnvironment,
} from '../action-error-handler';

describe('action-error-handler', () => {
  const originalEnv = process.env.APP_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.APP_ENV = originalEnv;
  });

  describe('generateHighEntropyErrorRef', () => {
    it('should generate a 12-hex uppercase reference prefixed with ERR-', () => {
      const ref = generateHighEntropyErrorRef();
      expect(ref).toMatch(/^ERR-[0-9A-F]{12}$/);
    });

    it('should generate unique references across calls', () => {
      const ref1 = generateHighEntropyErrorRef();
      const ref2 = generateHighEntropyErrorRef();
      expect(ref1).not.toBe(ref2);
    });
  });

  describe('sanitizeDiagnosticContext', () => {
    it('should return undefined when context is missing', () => {
      expect(sanitizeDiagnosticContext(undefined)).toBeUndefined();
    });

    it('should sanitize and pass through approved diagnostic keys', () => {
      const rawContext: any = {
        clientLEId: 'le-123',
        fieldNo: 42,
        rowId: 'row-1',
        customFieldId: 'cf-1',
        actionName: 'update',
        entityType: 'CLIENT_LE',
        collectionId: 'col-1',
        attachmentDocumentId: 'doc-1',
        instanceId: 'inst-1',
      };
      const sanitized = sanitizeDiagnosticContext(rawContext);
      expect(sanitized).toEqual(rawContext);
    });

    it('should strip unapproved keys and untrusted entityType values at runtime', () => {
      const rawContext: any = {
        clientLEId: 'le-123',
        fieldNo: 'invalid-number-type', // not a number
        entityType: 'SUPER_ADMIN_UNTRUSTED', // untrusted string
        unapprovedSecretKey: 'top_secret',
        requestPayload: { pii: 'john@example.com' },
      };
      const sanitized = sanitizeDiagnosticContext(rawContext);
      expect(sanitized).toEqual({
        clientLEId: 'le-123',
        fieldNo: undefined,
        rowId: undefined,
        customFieldId: undefined,
        actionName: undefined,
        entityType: undefined,
        collectionId: undefined,
        attachmentDocumentId: undefined,
        instanceId: undefined,
      });
      expect((sanitized as any).unapprovedSecretKey).toBeUndefined();
      expect((sanitized as any).requestPayload).toBeUndefined();
    });
  });

  describe('isLocalhostServerEnvironment', () => {
    it('should return true ONLY when APP_ENV is "localhost"', () => {
      process.env.APP_ENV = 'localhost';
      expect(isLocalhostServerEnvironment()).toBe(true);
    });

    it('should fail closed for dev, staging, production, or undefined', () => {
      process.env.APP_ENV = 'dev';
      expect(isLocalhostServerEnvironment()).toBe(false);

      process.env.APP_ENV = 'development';
      expect(isLocalhostServerEnvironment()).toBe(false);

      process.env.APP_ENV = 'production';
      expect(isLocalhostServerEnvironment()).toBe(false);

      delete process.env.APP_ENV;
      expect(isLocalhostServerEnvironment()).toBe(false);
    });
  });

  describe('handleActionError', () => {
    it('should handle ActionDomainError as safe domain failure without errorRef', () => {
      const domainErr = new ActionDomainError('Field 1 is locked to authoritative sources.');
      const result = handleActionError(domainErr, {
        operation: 'Save Master field',
        fallbackMessage: 'We couldn’t save this field.',
      });

      expect(result).toEqual({
        success: false,
        kind: 'domain',
        message: 'Field 1 is locked to authoritative sources.',
        error: 'Field 1 is locked to authoritative sources.',
        operation: 'Save Master field',
        timestamp: expect.any(String),
      });
      expect((result as any).errorRef).toBeUndefined();
    });

    it('should handle unexpected Prisma/DB errors as unexpected failure with errorRef and sanitized logging', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      delete process.env.APP_ENV; // Deployed env (fails closed)

      const dbError = new Error('Invalid byte sequence for encoding "UTF8": 0x00 at prisma.fieldClaim.create()');
      const result = handleActionError(dbError, {
        operation: 'Save Master field',
        fallbackMessage: 'We couldn’t save this field.',
        context: { clientLEId: 'le-100', fieldNo: 5, entityType: 'CLIENT_LE' },
      });

      expect(result.success).toBe(false);
      if (result.kind === 'unexpected') {
        expect(result.kind).toBe('unexpected');
        expect(result.message).toBe('We couldn’t save this field.');
        expect(result.errorRef).toMatch(/^ERR-[0-9A-F]{12}$/);
        expect(result.operation).toBe('Save Master field');
        expect(result.timestamp).toBeTruthy();
        expect(result.technicalDetails).toBeUndefined();
      } else {
        throw new Error('Expected unexpected failure kind');
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ACTION_ERROR]'),
        expect.objectContaining({
          errorRef: result.errorRef,
          operation: 'Save Master field',
          message: 'Invalid byte sequence for encoding "UTF8": 0x00 at prisma.fieldClaim.create()',
          context: {
            clientLEId: 'le-100',
            fieldNo: 5,
            entityType: 'CLIENT_LE',
          },
        })
      );
    });

    it('should include technicalDetails ONLY when APP_ENV === "localhost"', () => {
      process.env.APP_ENV = 'localhost';
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at assertClaim (FieldClaimService.ts:123)';

      const result = handleActionError(error, {
        operation: 'Save Master field',
        fallbackMessage: 'We couldn’t save this field.',
      });

      expect(result.kind).toBe('unexpected');
      if (result.kind === 'unexpected') {
        expect(result.technicalDetails).toContain('Error: Database connection failed');
        expect(result.technicalDetails).toContain('FieldClaimService.ts:123');
      }
    });

    it('should handle non-Error thrown objects/strings cleanly', () => {
      delete process.env.APP_ENV;
      const result = handleActionError('String error throw', {
        operation: 'Save custom field',
        fallbackMessage: 'We couldn’t save this field.',
      });

      expect(result.kind).toBe('unexpected');
      if (result.kind === 'unexpected') {
        expect(result.message).toBe('We couldn’t save this field.');
        expect(result.errorRef).toMatch(/^ERR-[0-9A-F]{12}$/);
      }
    });
  });
});
