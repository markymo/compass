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

        it('returns CHECKED_NO_DATA when source evaluated, no value, even if empty or genuine default configured', () => {
            const stateWithDefault = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: true,
                defaultText: 'Default'
            });
            expect(stateWithDefault).toBe('CHECKED_NO_DATA');

            const stateWithEmptyDefault = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: true,
                defaultText: ''
            });
            expect(stateWithEmptyDefault).toBe('CHECKED_NO_DATA');
        });

        it('returns DEFAULT_RESPONSE when no applicable evaluation and a genuine default is configured', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: false,
                defaultText: 'Default'
            });
            expect(state).toBe('DEFAULT_RESPONSE');
        });

        it('returns DEFAULT_RESPONSE even if not mapped when a genuine default is configured', () => {
            const state = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: 'Fallback Value'
            });
            expect(state).toBe('DEFAULT_RESPONSE');
        });

        it('returns MAPPED_NOT_CHECKED when applicable mapping exists, not evaluated, no genuine default', () => {
            const stateUndefined = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: false,
                defaultText: undefined
            });
            expect(stateUndefined).toBe('MAPPED_NOT_CHECKED');

            const stateEmpty = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: false,
                defaultText: ''
            });
            expect(stateEmpty).toBe('MAPPED_NOT_CHECKED');

            const stateWhitespace = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: false,
                defaultText: '   '
            });
            expect(stateWhitespace).toBe('MAPPED_NOT_CHECKED');
        });

        it('returns UNMAPPED_NO_RESPONSE when no mapping, no evaluation, and no genuine default', () => {
            const stateUndefined = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: undefined
            });
            expect(stateUndefined).toBe('UNMAPPED_NO_RESPONSE');

            const stateNull = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: null
            });
            expect(stateNull).toBe('UNMAPPED_NO_RESPONSE');

            const stateEmpty = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: ''
            });
            expect(stateEmpty).toBe('UNMAPPED_NO_RESPONSE');

            const stateWhitespace = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: false,
                hasApplicableEvaluationAttempt: false,
                defaultText: '   \t  '
            });
            expect(stateWhitespace).toBe('UNMAPPED_NO_RESPONSE');
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
            const result = KycStateService.evaluateSyncAttempt({ lei: '5493001KJTIIGC8Y1R12', gleifFetchedAt: null }, mappings);
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
            expect(result.hasApplicableMapping).toBe(false);
            expect(result.hasApplicableEvaluationAttempt).toBe(false);
        });
    });

    describe('Required Regression Suite (A - E)', () => {
        // A. TotalEnergies / F20 pattern
        it('A. TotalEnergies / F20 pattern: Non-CH LE + CH mapping + no CH ref -> UNMAPPED_NO_RESPONSE (empty/unset, NOT None)', () => {
            const clientLE = {
                gleifFetchedAt: null,
                registryReferences: [{ authority: { registryKey: 'FR_SIRENE', mappingSourceKey: 'RA000192' } }]
            };
            const mappings = [{ sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE' }];
            const evalResult = KycStateService.evaluateSyncAttempt(clientLE, mappings);

            expect(evalResult.hasApplicableMapping).toBe(false);
            expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

            const displayState = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: evalResult.hasApplicableMapping,
                hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt,
                defaultText: null
            });
            expect(displayState).toBe('UNMAPPED_NO_RESPONSE');
        });

        // B. Applicable CH mapping, never checked
        it('B. Applicable CH mapping, never checked: CH LE + matching CH ref + no fetch -> MAPPED_NOT_CHECKED (empty/unset, NOT None)', () => {
            const clientLE = {
                gleifFetchedAt: null,
                registryReferences: [{ authority: { registryKey: 'COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE' }, lastSyncSucceededAt: null }]
            };
            const mappings = [{ sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE' }];
            const evalResult = KycStateService.evaluateSyncAttempt(clientLE, mappings);

            expect(evalResult.hasApplicableMapping).toBe(true);
            expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

            const displayState = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: evalResult.hasApplicableMapping,
                hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt,
                defaultText: null
            });
            expect(displayState).toBe('MAPPED_NOT_CHECKED');
        });

        // C. Applicable CH mapping, checked, returned nothing
        it('C. Applicable CH mapping, checked, returned nothing: -> CHECKED_NO_DATA (NO_DATA / None)', () => {
            const clientLE = {
                gleifFetchedAt: null,
                registryReferences: [{ authority: { registryKey: 'COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE' }, lastSyncSucceededAt: new Date() }]
            };
            const mappings = [{ sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE' }];
            const evalResult = KycStateService.evaluateSyncAttempt(clientLE, mappings);

            expect(evalResult.hasApplicableMapping).toBe(true);
            expect(evalResult.hasApplicableEvaluationAttempt).toBe(true);

            const displayState = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: evalResult.hasApplicableMapping,
                hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt,
                defaultText: null
            });
            expect(displayState).toBe('CHECKED_NO_DATA');
        });

        // D. Applicable mapping with value
        it('D. Applicable mapping with value: -> HAS_VALUE (POPULATED)', () => {
            const displayState = KycStateService.calculateDisplayState({
                hasValue: true,
                hasApplicableMapping: true,
                hasApplicableEvaluationAttempt: true,
                defaultText: null
            });
            expect(displayState).toBe('HAS_VALUE');
        });

        // E. Cross-jurisdiction test
        it('E. Cross-jurisdiction test: RA A mapping does NOT become applicable to LE attached only to RA B', () => {
            const clientLE = {
                registryReferences: [{ authority: { registryKey: 'DE_HANDELSREGISTER', mappingSourceKey: 'RA000001' }, lastSyncSucceededAt: new Date() }]
            };
            const mappings = [{ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE' }];
            const evalResult = KycStateService.evaluateSyncAttempt(clientLE, mappings);

            expect(evalResult.hasApplicableMapping).toBe(false);
            expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

            const displayState = KycStateService.calculateDisplayState({
                hasValue: false,
                hasApplicableMapping: evalResult.hasApplicableMapping,
                hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt,
                defaultText: null
            });
            expect(displayState).toBe('UNMAPPED_NO_RESPONSE');
        });
    });
});
