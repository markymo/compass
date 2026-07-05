import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compareAndLogShadowRender } from '../shadow-logger';
import { FieldDisplayModel } from '../field-display-model';

describe('shadow-logger', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env = originalEnv;
    });

    const mockModel: FieldDisplayModel = {
        fieldNo: 1,
        label: 'Test Field',
        state: 'POPULATED',
        value: { kind: 'scalar', display: 'New Text', rawValue: 'New Text' },
        source: { type: 'USER_INPUT', label: 'User', colorKey: 'USER', category: 'USER' },
        textSummary: 'New Text',
        isEditable: true,
        isMultiValue: false,
    };

    it('does not log when texts match exactly', () => {
        process.env.NODE_ENV = 'development';
        process.env.ENABLE_MD_SHADOW_LOGGING = 'true';

        compareAndLogShadowRender('New Text', mockModel);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('does not log when texts match ignoring whitespace', () => {
        process.env.NODE_ENV = 'development';
        process.env.ENABLE_MD_SHADOW_LOGGING = 'true';

        compareAndLogShadowRender('  New Text  ', mockModel);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('does not log mismatches when ENABLE_MD_SHADOW_LOGGING is false', () => {
        process.env.NODE_ENV = 'development';
        process.env.ENABLE_MD_SHADOW_LOGGING = 'false';

        compareAndLogShadowRender('Old Text', mockModel);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('does not log mismatches in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_MD_SHADOW_LOGGING = 'true'; // Should be ignored in prod

        compareAndLogShadowRender('Old Text', mockModel);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('logs structured mismatch when enabled in development', () => {
        process.env.NODE_ENV = 'development';
        process.env.ENABLE_MD_SHADOW_LOGGING = 'true';

        compareAndLogShadowRender('Old Text', mockModel);
        
        expect(console.warn).toHaveBeenCalledWith(`[MD_SHADOW_MISMATCH] Field #1 ("Test Field")`);
        expect(console.warn).toHaveBeenCalledWith(`  ↳ Old: "Old Text"`);
        expect(console.warn).toHaveBeenCalledWith(`  ↳ New: "New Text"`);
        expect(console.warn).toHaveBeenCalledWith(`  ↳ State: POPULATED`);
        expect(console.warn).toHaveBeenCalledWith(`  ↳ Source: USER_INPUT (none)`);
    });
});
