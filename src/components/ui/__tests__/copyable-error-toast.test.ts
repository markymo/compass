import { describe, it, expect } from 'vitest';
import { formatErrorForClipboard } from '../copyable-error-toast';

describe('formatErrorForClipboard', () => {
  it('should format clean message with reference, time, and operation', () => {
    const output = formatErrorForClipboard("We couldn't save this field.", {
      errorRef: 'ERR-3FA91C72B8E4',
      timestamp: '2026-08-27T20:34:00.000Z',
      operation: 'Save Master field',
    });

    expect(output).toContain('OnPro error');
    expect(output).toContain("We couldn't save this field.");
    expect(output).toContain('Reference: ERR-3FA91C72B8E4');
    expect(output).toContain('Time: Thu, 27 Aug 2026 20:34:00 GMT');
    expect(output).toContain('Operation: Save Master field');
    expect(output).not.toContain('Technical Details:');
  });

  it('should include technicalDetails when present on localhost', () => {
    const output = formatErrorForClipboard("We couldn't save this field.", {
      errorRef: 'ERR-3FA91C72B8E4',
      timestamp: '2026-08-27T20:34:00.000Z',
      operation: 'Save Master field',
      technicalDetails: 'PrismaClientKnownRequestError: Invalid byte sequence for encoding "UTF8": 0x00',
    });

    expect(output).toContain('Technical Details:');
    expect(output).toContain('PrismaClientKnownRequestError: Invalid byte sequence');
  });
});
