import { describe, it, expect } from 'vitest';
import { resolveCanonicalFieldDisplay } from '@/lib/export/export-answer-resolver';
import { toExportText } from '@/lib/export/toExportText';
import { extractFieldOptions, resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';
import gleifLegalJurisdictions from '../../../scripts/gleif-legal-jurisdictions.json';

describe('ONP-203 — Jurisdiction Surface & Canonical Resolution Tests', () => {
    const gleifOptionSet = {
        id: '192aa8b1-a1bd-4e69-b50c-a9f06f61cf53',
        name: 'GLEIF_Legal_Jurisdictions',
        options: gleifLegalJurisdictions
    };

    const f134Def = {
        fieldNo: 134,
        fieldName: 'Country of formation',
        appDataType: 'TEXT',
        isMultiValue: false,
        optionSet: gleifOptionSet
    };

    const f143Def = {
        fieldNo: 143,
        fieldName: 'Tax residence 1',
        appDataType: 'SELECT',
        isMultiValue: false,
        optionSet: gleifOptionSet
    };

    const f156Def = {
        fieldNo: 156,
        fieldName: 'Tax residence 2',
        appDataType: 'SELECT',
        isMultiValue: false,
        optionSet: gleifOptionSet
    };

    const f157Def = {
        fieldNo: 157,
        fieldName: 'Tax residence 3',
        appDataType: 'SELECT',
        isMultiValue: false,
        optionSet: gleifOptionSet
    };

    describe('1. F134 — Country of formation (TEXT field with reference dataset)', () => {
        it('resolves raw GLEIF code "GB" to canonical label while preserving rawValue exactly', () => {
            const options = extractFieldOptions(f134Def);
            const metadata = {
                fieldNo: 134,
                label: 'Country of formation',
                appDataType: 'TEXT',
                options
            };

            const model = resolveFieldForDisplay('GB', { type: 'GLEIF', reference: 'entity.jurisdiction' }, metadata);

            expect(model.state).toBe('POPULATED');
            expect(model.value.kind).toBe('scalar');
            if (model.value.kind === 'scalar') {
                expect(model.value.rawValue).toBe('GB');
                expect(model.value.display).toBe('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
            }
            expect(model.textSummary).toBe('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
        });

        it('resolves raw subdivision code "US-DE" to canonical label while preserving rawValue', () => {
            const options = extractFieldOptions(f134Def);
            const metadata = {
                fieldNo: 134,
                label: 'Country of formation',
                appDataType: 'TEXT',
                options
            };

            const model = resolveFieldForDisplay('US-DE', { type: 'GLEIF', reference: 'entity.jurisdiction' }, metadata);

            expect(model.state).toBe('POPULATED');
            expect(model.value.kind).toBe('scalar');
            if (model.value.kind === 'scalar') {
                expect(model.value.rawValue).toBe('US-DE');
                expect(model.value.display).toBe('US-DE \u2013 Delaware (United States of America)');
            }
            expect(model.textSummary).toBe('US-DE \u2013 Delaware (United States of America)');
        });

        it('falls back safely to raw code without blanking or rewriting when code is unknown', () => {
            const options = extractFieldOptions(f134Def);
            const metadata = {
                fieldNo: 134,
                label: 'Country of formation',
                appDataType: 'TEXT',
                options
            };

            const model = resolveFieldForDisplay('XX-NEW', { type: 'GLEIF', reference: 'entity.jurisdiction' }, metadata);

            expect(model.state).toBe('POPULATED');
            expect(model.value.kind).toBe('scalar');
            if (model.value.kind === 'scalar') {
                expect(model.value.rawValue).toBe('XX-NEW');
                expect(model.value.display).toBe('XX-NEW');
            }
            expect(model.textSummary).toBe('XX-NEW');
        });
    });

    describe('2. F143, F156, F157 — Tax Residence Fields (SELECT fields)', () => {
        it('Surface 1 & 2: F143 resolves "FR" to "FR – France" while preserving rawValue "FR"', () => {
            const options = extractFieldOptions(f143Def);
            const metadata = {
                fieldNo: 143,
                label: 'Tax residence 1',
                appDataType: 'SELECT',
                options
            };

            const model = resolveFieldForDisplay('FR', { type: 'USER_INPUT' }, metadata);

            expect(model.state).toBe('POPULATED');
            expect(model.value.kind).toBe('scalar');
            if (model.value.kind === 'scalar') {
                expect(model.value.rawValue).toBe('FR');
                expect(model.value.display).toBe('FR \u2013 France');
            }
            expect(model.textSummary).toBe('FR \u2013 France');
        });

        it('Surface 3: Workbench4 canonical model resolution for F156 with "GB-SCT"', () => {
            const options = extractFieldOptions(f156Def);
            const metadata = {
                fieldNo: 156,
                label: 'Tax residence 2',
                displayState: 'HAS_VALUE' as const,
                appDataType: 'SELECT',
                options
            };

            const model = resolveFieldForDisplay('GB-SCT', { type: 'USER_INPUT' }, metadata);

            expect(model.value.kind).toBe('scalar');
            if (model.value.kind === 'scalar') {
                expect(model.value.rawValue).toBe('GB-SCT');
                expect(model.value.display).toBe('GB-SCT \u2013 Scotland (United Kingdom of Great Britain and Northern Ireland)');
            }
        });

        it('Surface 4: Export / PDF canonical resolution and toExportText for F157 with "CA-ON"', async () => {
            const options = extractFieldOptions(f157Def);
            const meta = {
                fieldNo: 157,
                label: 'Tax residence 3',
                displayState: 'HAS_VALUE' as const,
                appDataType: 'SELECT',
                options
            };

            const { displayModel, displayValue } = await resolveCanonicalFieldDisplay({
                derivedValue: 'CA-ON',
                primarySource: { type: 'USER_INPUT' },
                meta
            });

            expect(displayModel.value.kind).toBe('scalar');
            if (displayModel.value.kind === 'scalar') {
                expect(displayModel.value.rawValue).toBe('CA-ON');
                expect(displayModel.value.display).toBe('CA-ON \u2013 Ontario (Canada)');
            }
            expect(displayValue).toBe('CA-ON \u2013 Ontario (Canada)');
            expect(toExportText(displayModel)).toBe('CA-ON \u2013 Ontario (Canada)');
        });
    });

    describe('3. SELECT Search & Matching (F143, F156, F157)', () => {
        it('matches options by exact code (e.g. "US-DE")', () => {
            const options = extractFieldOptions(f143Def)!;
            const query = 'US-DE';
            const matched = options.filter(opt =>
                opt.value.toLowerCase().includes(query.toLowerCase()) ||
                opt.label.toLowerCase().includes(query.toLowerCase())
            );

            expect(matched.length).toBeGreaterThanOrEqual(1);
            expect(matched[0].value).toBe('US-DE');
            expect(matched[0].label).toBe('US-DE \u2013 Delaware (United States of America)');
        });

        it('matches options by jurisdiction name keyword (e.g. "Delaware")', () => {
            const options = extractFieldOptions(f143Def)!;
            const query = 'Delaware';
            const matched = options.filter(opt =>
                opt.value.toLowerCase().includes(query.toLowerCase()) ||
                opt.label.toLowerCase().includes(query.toLowerCase())
            );

            expect(matched.length).toBe(1);
            expect(matched[0].value).toBe('US-DE');
        });

        it('matches options by country name keyword for subdivisions (e.g. "Scotland")', () => {
            const options = extractFieldOptions(f143Def)!;
            const query = 'Scotland';
            const matched = options.filter(opt =>
                opt.value.toLowerCase().includes(query.toLowerCase()) ||
                opt.label.toLowerCase().includes(query.toLowerCase())
            );

            expect(matched.length).toBe(1);
            expect(matched[0].value).toBe('GB-SCT');
        });
    });
});
