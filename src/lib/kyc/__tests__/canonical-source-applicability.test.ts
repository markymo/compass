import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycStateService } from '../KycStateService';
import { resolveFieldForDisplay, resolveFieldCollectionForDisplay } from '@/lib/master-data/field-interpreter';

describe('Canonical Source-Applicability & Evaluation Fix Matrix', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 1: TotalEnergies / F20 (French LE + CH F20 mapping)
    // ─────────────────────────────────────────────────────────────────────────
    it('1. TotalEnergies: French LE + Companies House mapping -> UNMAPPED_NO_RESPONSE / UNMAPPED (not None)', () => {
        const frenchClientLE = {
            lei: null,
            gleifFetchedAt: null,
            registryReferences: [
                {
                    registryAuthorityId: 'FR_RNCS',
                    authority: { registryKey: 'FR_RNCS', mappingSourceKey: 'FR_RNCS', name: 'RCS France' },
                    lastSyncSucceededAt: new Date(),
                }
            ]
        };

        const chMapping = [
            { sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE', targetFieldNo: 20 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(frenchClientLE, chMapping);
        expect(evalResult.hasApplicableMapping).toBe(false);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

        const displayState = KycStateService.calculateDisplayState({
            hasValue: false,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt,
            defaultText: null
        });

        expect(displayState).toBe('UNMAPPED_NO_RESPONSE');

        const model = resolveFieldForDisplay(null, null, {
            fieldNo: 20,
            label: 'NACE / Sector Classification',
            displayState
        });

        expect(model.state).toBe('UNMAPPED');
        expect(model.state).not.toBe('NO_DATA');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 2: UK Companies House LE + CH mapping, never refreshed
    // ─────────────────────────────────────────────────────────────────────────
    it('2. UK Companies House LE + CH mapping, never refreshed -> MAPPED_NOT_CHECKED / UNMAPPED (not None)', () => {
        const ukClientLE = {
            lei: null,
            gleifFetchedAt: null,
            registryReferences: [
                {
                    registryAuthorityId: 'RA000585',
                    authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE', name: 'Companies House' },
                    lastSyncSucceededAt: null,
                    lastSyncAttemptAt: null,
                    createdAt: new Date('2026-01-01')
                }
            ]
        };

        const chMapping = [
            { sourceType: 'COMPANIES_HOUSE', sourceReference: 'COMPANIES_HOUSE', targetFieldNo: 3 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(ukClientLE, chMapping);
        expect(evalResult.hasApplicableMapping).toBe(true);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

        const displayState = KycStateService.calculateDisplayState({
            hasValue: false,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt
        });

        expect(displayState).toBe('MAPPED_NOT_CHECKED');

        const model = resolveFieldForDisplay(null, null, {
            fieldNo: 3,
            label: 'Company Name',
            displayState
        });

        expect(model.state).toBe('UNMAPPED');
        expect(model.state).not.toBe('NO_DATA');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 3: UK Companies House LE + failed refresh attempt
    // ─────────────────────────────────────────────────────────────────────────
    it('3. UK Companies House LE + failed refresh (lastSyncAttemptAt set, lastSyncSucceededAt null) -> MAPPED_NOT_CHECKED / UNMAPPED', () => {
        const ukClientLE = {
            lei: null,
            gleifFetchedAt: null,
            registryReferences: [
                {
                    registryAuthorityId: 'RA000585',
                    authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE', name: 'Companies House' },
                    lastSyncSucceededAt: null,
                    lastSyncAttemptAt: new Date('2026-08-17T12:00:00Z'),
                    createdAt: new Date('2026-01-01')
                }
            ]
        };

        const chMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', targetFieldNo: 3 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(ukClientLE, chMapping);
        expect(evalResult.hasApplicableMapping).toBe(true);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

        const displayState = KycStateService.calculateDisplayState({
            hasValue: false,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt
        });

        expect(displayState).toBe('MAPPED_NOT_CHECKED');

        const model = resolveFieldForDisplay(null, null, {
            fieldNo: 3,
            label: 'Company Name',
            displayState
        });

        expect(model.state).toBe('UNMAPPED');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 4: UK Companies House LE + successful refresh + field missing
    // ─────────────────────────────────────────────────────────────────────────
    it('4. UK Companies House LE + successful refresh (lastSyncSucceededAt set) + field missing -> CHECKED_NO_DATA / NO_DATA (None)', () => {
        const syncDate = new Date('2026-08-17T10:00:00Z');
        const ukClientLE = {
            lei: null,
            gleifFetchedAt: null,
            registryReferences: [
                {
                    registryAuthorityId: 'RA000585',
                    authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE', name: 'Companies House' },
                    lastSyncSucceededAt: syncDate,
                    lastSyncAttemptAt: syncDate,
                    createdAt: new Date('2026-01-01')
                }
            ]
        };

        const chMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', targetFieldNo: 20 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(ukClientLE, chMapping);
        expect(evalResult.hasApplicableMapping).toBe(true);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(true);
        expect(evalResult.evaluatedSourceTimestamp).toEqual(syncDate);

        const displayState = KycStateService.calculateDisplayState({
            hasValue: false,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt
        });

        expect(displayState).toBe('CHECKED_NO_DATA');

        const model = resolveFieldForDisplay(null, null, {
            fieldNo: 20,
            label: 'NACE / Sector Classification',
            displayState
        });

        expect(model.state).toBe('NO_DATA');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 5: UK Companies House LE + successful value
    // ─────────────────────────────────────────────────────────────────────────
    it('5. UK Companies House LE + value present -> HAS_VALUE / POPULATED', () => {
        const ukClientLE = {
            lei: null,
            gleifFetchedAt: null,
            registryReferences: [
                {
                    registryAuthorityId: 'RA000585',
                    authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE', name: 'Companies House' },
                    lastSyncSucceededAt: new Date()
                }
            ]
        };

        const chMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', targetFieldNo: 3 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(ukClientLE, chMapping);
        const displayState = KycStateService.calculateDisplayState({
            hasValue: true,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt
        });

        expect(displayState).toBe('HAS_VALUE');

        const model = resolveFieldForDisplay('Acme UK Ltd', null, {
            fieldNo: 3,
            label: 'Company Name',
            displayState
        });

        expect(model.state).toBe('POPULATED');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 6: French LE + matching French registry mapping
    // ─────────────────────────────────────────────────────────────────────────
    it('6. French LE + matching French mapping -> applicable (un-refreshed vs checked no-data)', () => {
        const frenchMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'FR_RNCS', targetFieldNo: 3 }
        ];

        // Case 6a: Never refreshed
        const unrefreshedFrenchLE = {
            registryReferences: [
                {
                    registryAuthorityId: 'FR_RNCS',
                    authority: { registryKey: 'FR_RNCS', mappingSourceKey: 'FR_RNCS', name: 'RCS France' },
                    lastSyncSucceededAt: null
                }
            ]
        };
        const evalUnrefreshed = KycStateService.evaluateSyncAttempt(unrefreshedFrenchLE, frenchMapping);
        expect(evalUnrefreshed.hasApplicableMapping).toBe(true);
        expect(evalUnrefreshed.hasApplicableEvaluationAttempt).toBe(false);

        // Case 6b: Successfully refreshed, no value
        const checkedFrenchLE = {
            registryReferences: [
                {
                    registryAuthorityId: 'FR_RNCS',
                    authority: { registryKey: 'FR_RNCS', mappingSourceKey: 'FR_RNCS', name: 'RCS France' },
                    lastSyncSucceededAt: new Date('2026-08-15T00:00:00Z')
                }
            ]
        };
        const evalChecked = KycStateService.evaluateSyncAttempt(checkedFrenchLE, frenchMapping);
        expect(evalChecked.hasApplicableMapping).toBe(true);
        expect(evalChecked.hasApplicableEvaluationAttempt).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 7: French LE + German registry mapping
    // ─────────────────────────────────────────────────────────────────────────
    it('7. French LE + German registry mapping -> NOT applicable', () => {
        const frenchLE = {
            registryReferences: [
                {
                    registryAuthorityId: 'FR_RNCS',
                    authority: { registryKey: 'FR_RNCS', mappingSourceKey: 'FR_RNCS', name: 'RCS France' },
                    lastSyncSucceededAt: new Date()
                }
            ]
        };

        const germanMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'DE_HRB', targetFieldNo: 3 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(frenchLE, germanMapping);
        expect(evalResult.hasApplicableMapping).toBe(false);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 8: Generic sourceReference = "ALL"
    // ─────────────────────────────────────────────────────────────────────────
    it('8. Generic sourceReference = ALL -> applicable ONLY if Client LE has at least 1 RegistryReference', () => {
        const allMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'ALL', targetFieldNo: 10 }
        ];

        const ukLE = { registryReferences: [{ registryAuthorityId: 'RA000585' }] };
        const frenchLE = { registryReferences: [{ registryAuthorityId: 'FR_RNCS' }] };
        const noRefLE = { registryReferences: [] };
        const nullRefLE = { registryReferences: null };

        expect(KycStateService.isMappingApplicableToLE(allMapping[0], ukLE)).toBe(true);
        expect(KycStateService.isMappingApplicableToLE(allMapping[0], frenchLE)).toBe(true);
        expect(KycStateService.isMappingApplicableToLE(allMapping[0], noRefLE)).toBe(false);
        expect(KycStateService.isMappingApplicableToLE(allMapping[0], nullRefLE)).toBe(false);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 9: GLEIF valid LEI, never fetched
    // ─────────────────────────────────────────────────────────────────────────
    it('9. GLEIF valid LEI, never fetched -> applicable / MAPPED_NOT_CHECKED / UNMAPPED', () => {
        const gleifLE = {
            lei: '5493001KJTIIGC8Y1R12',
            gleifFetchedAt: null,
            registryReferences: []
        };

        const gleifMapping = [
            { sourceType: 'GLEIF', sourceReference: null, targetFieldNo: 1 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(gleifLE, gleifMapping);
        expect(evalResult.hasApplicableMapping).toBe(true);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

        const displayState = KycStateService.calculateDisplayState({
            hasValue: false,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt
        });

        expect(displayState).toBe('MAPPED_NOT_CHECKED');
        const model = resolveFieldForDisplay(null, null, { fieldNo: 1, label: 'LEI', displayState });
        expect(model.state).toBe('UNMAPPED');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 10: GLEIF valid LEI, successfully fetched, field absent
    // ─────────────────────────────────────────────────────────────────────────
    it('10. GLEIF valid LEI, successfully fetched, field absent -> CHECKED_NO_DATA / NO_DATA', () => {
        const fetchDate = new Date('2026-08-10T00:00:00Z');
        const gleifLE = {
            lei: '5493001KJTIIGC8Y1R12',
            gleifFetchedAt: fetchDate,
            registryReferences: []
        };

        const gleifMapping = [
            { sourceType: 'GLEIF', sourceReference: null, targetFieldNo: 1 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(gleifLE, gleifMapping);
        expect(evalResult.hasApplicableMapping).toBe(true);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(true);
        expect(evalResult.evaluatedSourceTimestamp).toEqual(fetchDate);

        const displayState = KycStateService.calculateDisplayState({
            hasValue: false,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt
        });

        expect(displayState).toBe('CHECKED_NO_DATA');
        const model = resolveFieldForDisplay(null, null, { fieldNo: 1, label: 'LEI', displayState });
        expect(model.state).toBe('NO_DATA');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 11: GLEIF null
    // ─────────────────────────────────────────────────────────────────────────
    it('11. GLEIF lei: null, gleifFetchedAt: null -> NOT applicable / UNMAPPED_NO_RESPONSE', () => {
        const gleifLE = {
            lei: null,
            gleifFetchedAt: null,
            registryReferences: []
        };

        const gleifMapping = [
            { sourceType: 'GLEIF', sourceReference: null, targetFieldNo: 1 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(gleifLE, gleifMapping);
        expect(evalResult.hasApplicableMapping).toBe(false);
        expect(evalResult.hasApplicableEvaluationAttempt).toBe(false);

        const displayState = KycStateService.calculateDisplayState({
            hasValue: false,
            hasApplicableMapping: evalResult.hasApplicableMapping,
            hasApplicableEvaluationAttempt: evalResult.hasApplicableEvaluationAttempt
        });

        expect(displayState).toBe('UNMAPPED_NO_RESPONSE');
        const model = resolveFieldForDisplay(null, null, { fieldNo: 1, label: 'LEI', displayState });
        expect(model.state).toBe('UNMAPPED');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 12: Multi-registry Client LE & Reference Ordering
    // ─────────────────────────────────────────────────────────────────────────
    it('12. Multi-registry Client LE: applicability evaluates ALL references regardless of ordering (guards against take:1)', () => {
        // LE with French RNCS at index 0 and UK Companies House at index 1
        const multiRegistryLE = {
            lei: null,
            gleifFetchedAt: null,
            registryReferences: [
                {
                    registryAuthorityId: 'FR_RNCS',
                    authority: { registryKey: 'FR_RNCS', mappingSourceKey: 'FR_RNCS', name: 'RCS France' },
                    lastSyncSucceededAt: new Date('2026-08-01')
                },
                {
                    registryAuthorityId: 'RA000585',
                    authority: { registryKey: 'GB_COMPANIES_HOUSE', mappingSourceKey: 'COMPANIES_HOUSE', name: 'Companies House' },
                    lastSyncSucceededAt: new Date('2026-08-10')
                }
            ]
        };

        const chMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', targetFieldNo: 3 }
        ];

        const frenchMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'FR_RNCS', targetFieldNo: 3 }
        ];

        const evalCH = KycStateService.evaluateSyncAttempt(multiRegistryLE, chMapping);
        expect(evalCH.hasApplicableMapping).toBe(true);
        expect(evalCH.hasApplicableEvaluationAttempt).toBe(true);

        const evalFR = KycStateService.evaluateSyncAttempt(multiRegistryLE, frenchMapping);
        expect(evalFR.hasApplicableMapping).toBe(true);
        expect(evalFR.hasApplicableEvaluationAttempt).toBe(true);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 13: Legacy null sourceReference (Conservative fail closed)
    // ─────────────────────────────────────────────────────────────────────────
    it('13. Legacy null sourceReference: unscoped registry mapping does NOT apply to a specific unrelated registry', () => {
        const frenchLE = {
            registryReferences: [
                {
                    registryAuthorityId: 'FR_RNCS',
                    authority: { registryKey: 'FR_RNCS', mappingSourceKey: 'FR_RNCS', name: 'RCS France' },
                    lastSyncSucceededAt: new Date()
                }
            ]
        };

        // Unscoped REGISTRATION_AUTHORITY mapping (sourceReference is null)
        const unscopedMapping = [
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: null, targetFieldNo: 99 }
        ];

        const evalResult = KycStateService.evaluateSyncAttempt(frenchLE, unscopedMapping);
        expect(evalResult.hasApplicableMapping).toBe(false);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 14: Cross-surface Canonical Parity
    // ─────────────────────────────────────────────────────────────────────────
    it('14. Cross-surface canonical parity: Master Record, drawer, and workbench paths produce identical displayState & state', () => {
        const metadata = {
            fieldNo: 20,
            label: 'F20 NACE Code',
            displayState: 'UNMAPPED_NO_RESPONSE' as const
        };

        const modelFromScalar = resolveFieldForDisplay(null, null, metadata);
        const modelFromCollection = resolveFieldCollectionForDisplay([], metadata);

        expect(modelFromScalar.state).toBe('UNMAPPED');
        expect(modelFromCollection.state).toBe('UNMAPPED');
        expect(modelFromScalar.state).toEqual(modelFromCollection.state);
    });
});
