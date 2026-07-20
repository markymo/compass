import { describe, it, expect } from 'vitest';
import { KycStateService } from '../KycStateService';

describe('KycStateService Canonical State Resolver', () => {

    describe('calculateDisplayState', () => {
        it('returns HAS_VALUE when hasValue is true, regardless of mappings or defaults', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: true,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: true,
                defaultText: 'Default'
            });
            expect(state).toBe('HAS_VALUE');
        });

        it('returns CHECKED_NO_DATA when source evaluated, no value, default configured', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: true,
                defaultText: 'Default'
            });
            expect(state).toBe('CHECKED_NO_DATA');
        });

        it('returns DEFAULT_RESPONSE when no applicable evaluation, default configured', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: false,
                defaultText: 'Default'
            });
            expect(state).toBe('DEFAULT_RESPONSE');
        });

        it('returns DEFAULT_RESPONSE even if not mapped', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: 'Default'
            });
            expect(state).toBe('DEFAULT_RESPONSE');
        });

        it('returns MAPPED_NOT_CHECKED when applicable mapping exists, not evaluated, no default', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: false,
                defaultText: undefined
            });
            expect(state).toBe('MAPPED_NOT_CHECKED');
        });

        it('returns UNMAPPED_NO_RESPONSE when no mapping, no evaluation, no default', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: undefined
            });
            expect(state).toBe('UNMAPPED_NO_RESPONSE');
        });

        it('does not reject falsy valid defaults (e.g., empty string or "0" if configured)', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: '' // configured empty string
            });
            expect(state).toBe('DEFAULT_RESPONSE');
        });
    });

    describe('evaluateSyncAttempt', () => {
        it('returns false for everything if no mappings', () => {
            const result = KycStateService.evaluateSyncAttempt({ gleifFetchedAt: new Date() }, []);
            expect(result.hasApplicableMapping).toBe(false);
            expect(result.hasApplicableEvaluationAttempt).toBe(false);
        });

        it('evaluates GLEIF correctly', () => {
            const mappings = [{ sourceType: 'GLEIF', sourceReference: null }];
            const result = KycStateService.evaluateSyncAttempt({ gleifFetchedAt: new Date() }, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(true);
            expect(result.evaluatedSourceBadge).toBe('GLEIF');
        });

        it('does not evaluate GLEIF if not fetched', () => {
            const mappings = [{ sourceType: 'GLEIF', sourceReference: null }];
            const result = KycStateService.evaluateSyncAttempt({ gleifFetchedAt: null }, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(false);
        });

        it('evaluates REGISTRATION_AUTHORITY correctly with ALL', () => {
            const mappings = [{ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'ALL' }];
            const clientLE = {
                registryReferences: [{ lastSyncSucceededAt: new Date() }]
            };
            const result = KycStateService.evaluateSyncAttempt(clientLE, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(true);
        });

        it('evaluates REGISTRATION_AUTHORITY correctly with specific registryKey', () => {
            const mappings = [{ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'GB_CH' }];
            const clientLE = {
                registryReferences: [{ authority: { registryKey: 'GB_CH' }, lastSyncSucceededAt: new Date() }]
            };
            const result = KycStateService.evaluateSyncAttempt(clientLE, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(true);
            expect(result.evaluatedSourceBadge).toBe('GB_CH');
        });

        it('does NOT evaluate REGISTRATION_AUTHORITY if registryKeys mismatch', () => {
            const mappings = [{ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'FR_RNCS' }];
            const clientLE = {
                registryReferences: [{ authority: { registryKey: 'GB_CH' }, lastSyncSucceededAt: new Date() }]
            };
            const result = KycStateService.evaluateSyncAttempt(clientLE, mappings);
            expect(result.hasApplicableMapping).toBe(true);
            expect(result.hasApplicableEvaluationAttempt).toBe(false); // Should be false because FR_RNCS does not match GB_CH
        });
    });
});
