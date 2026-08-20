import { describe, it, expect } from 'vitest';
import { resolveFieldDisplayContext, resolveFieldForDisplay, resolveFieldCollectionForDisplay } from '../field-interpreter';
import { toExportText } from '@/lib/export/toExportText';

describe('Master Field Display Context', () => {
    describe('resolveFieldDisplayContext helper', () => {
        it('returns trimmed display context when enabled and non-empty', () => {
            const def = { displayContext: '  Direct parent with more than 50% ownership  ', displayContextEnabled: true };
            expect(resolveFieldDisplayContext(def)).toBe('Direct parent with more than 50% ownership');
        });

        it('returns undefined when displayContextEnabled is false', () => {
            const def = { displayContext: 'Direct parent with more than 50% ownership', displayContextEnabled: false };
            expect(resolveFieldDisplayContext(def)).toBeUndefined();
        });

        it('returns undefined when displayContext is blank or whitespace', () => {
            expect(resolveFieldDisplayContext({ displayContext: '   ', displayContextEnabled: true })).toBeUndefined();
            expect(resolveFieldDisplayContext({ displayContext: null, displayContextEnabled: true })).toBeUndefined();
            expect(resolveFieldDisplayContext(undefined)).toBeUndefined();
        });
    });

    describe('Canonical FieldDisplayModel integration', () => {
        it('exposes displayContext when field state is POPULATED', () => {
            const model = resolveFieldForDisplay(
                'ZZOOMM GROUP LIMITED',
                { type: 'GLEIF' },
                {
                    fieldNo: 37,
                    label: 'Direct parent (>50%)',
                    displayState: 'HAS_VALUE',
                    displayContext: 'Direct parent with more than 50% ownership'
                }
            );

            expect(model.state).toBe('POPULATED');
            expect(model.displayContext).toBe('Direct parent with more than 50% ownership');
        });

        it('does NOT expose displayContext when state is CHECKED_NO_DATA, UNMAPPED, DEFAULT, or EXPLICIT_NONE', () => {
            const noDataModel = resolveFieldForDisplay(
                null,
                null,
                {
                    fieldNo: 37,
                    label: 'Direct parent (>50%)',
                    displayState: 'CHECKED_NO_DATA',
                    displayContext: 'Direct parent with more than 50% ownership'
                }
            );
            expect(noDataModel.state).toBe('CHECKED_NO_DATA');
            expect(noDataModel.displayContext).toBeUndefined();

            const unmappedModel = resolveFieldForDisplay(
                null,
                null,
                {
                    fieldNo: 37,
                    label: 'Direct parent (>50%)',
                    displayState: 'UNMAPPED_NO_RESPONSE',
                    displayContext: 'Direct parent with more than 50% ownership'
                }
            );
            expect(unmappedModel.state).toBe('UNMAPPED');
            expect(unmappedModel.displayContext).toBeUndefined();

            const defaultModel = resolveFieldForDisplay(
                null,
                null,
                {
                    fieldNo: 37,
                    label: 'Direct parent (>50%)',
                    defaultText: 'Default Corp',
                    displayState: 'DEFAULT_RESPONSE',
                    displayContext: 'Direct parent with more than 50% ownership'
                }
            );
            expect(defaultModel.state).toBe('DEFAULT');
            expect(defaultModel.displayContext).toBeUndefined();
        });

        it('exposes displayContext once on collection fields when state is POPULATED', () => {
            const collectionModel = resolveFieldCollectionForDisplay(
                [
                    { value: 'Company A', source: { type: 'GLEIF' } },
                    { value: 'Company B', source: { type: 'GLEIF' } }
                ],
                {
                    fieldNo: 37,
                    label: 'Direct parent (>50%)',
                    displayState: 'HAS_VALUE',
                    isMultiValue: true,
                    displayContext: 'Direct parent with more than 50% ownership'
                }
            );

            expect(collectionModel.state).toBe('POPULATED');
            expect(collectionModel.displayContext).toBe('Direct parent with more than 50% ownership');
        });

        it('keeps displayContext separate from answer text and toExportText', () => {
            const model = resolveFieldForDisplay(
                'ZZOOMM GROUP LIMITED',
                { type: 'GLEIF' },
                {
                    fieldNo: 37,
                    label: 'Direct parent (>50%)',
                    displayState: 'HAS_VALUE',
                    displayContext: 'Direct parent with more than 50% ownership'
                }
            );

            expect(model.textSummary).toBe('ZZOOMM GROUP LIMITED');
            expect(toExportText(model)).toBe('ZZOOMM GROUP LIMITED');
            expect(toExportText(model)).not.toContain('Direct parent with more than 50% ownership');
        });
    });
});
