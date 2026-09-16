import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import the seed definition once exported, or inspect the seed file / json
import { OPTION_SETS } from '../../../scripts/seed-option-sets';

describe('ONP-190 — ISO_Currency_Code Option Set', () => {
    it('is registered in the OPTION_SETS seed configuration', () => {
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        expect(currencySet?.valueType).toBe('STRING');
        expect(Array.isArray(currencySet?.options)).toBe(true);
        expect(currencySet!.options.length).toBeGreaterThan(150);
    });

    it('has GBP, EUR, and USD at positions 0, 1, and 2 with official labels and Unicode en-dash', () => {
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        const options = currencySet!.options;

        expect(options[0]).toEqual({
            value: 'GBP',
            label: 'GBP \u2013 Pound Sterling',
        });
        expect(options[1]).toEqual({
            value: 'EUR',
            label: 'EUR \u2013 Euro',
        });
        expect(options[2]).toEqual({
            value: 'USD',
            label: 'USD \u2013 US Dollar',
        });
    });

    it('contains strictly 3-letter uppercase codes as raw values', () => {
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        const options = currencySet!.options;

        for (const opt of options) {
            expect(typeof opt.value).toBe('string');
            expect(opt.value).toMatch(/^[A-Z]{3}$/);
        }
    });

    it('formats all labels as "CODE \u2013 Currency Name" with Unicode en-dash', () => {
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        const options = currencySet!.options;

        for (const opt of options) {
            expect(typeof opt.label).toBe('string');
            expect(opt.label).toMatch(/^[A-Z]{3} \u2013 .+/);
            const [codePart] = opt.label.split(' \u2013 ');
            expect(codePart).toBe(opt.value);
        }
    });

    it('does not contain country codes accidentally used as currencies (e.g. GB, US, AF, AX, ZW)', () => {
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        const options = currencySet!.options;

        const values = options.map((o: any) => o.value);
        const countryCodes = ['GB', 'US', 'AF', 'AX', 'AL', 'DZ', 'ZW'];
        for (const cc of countryCodes) {
            expect(values).not.toContain(cc);
        }
    });

    it('excludes XXX (no currency involved) and XTS (test code)', () => {
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        const options = currencySet!.options;

        const values = options.map((o: any) => o.value);
        expect(values).not.toContain('XXX');
        expect(values).not.toContain('XTS');
    });

    it('sorts all remaining currencies (from index 3 onwards) alphabetically by 3-letter code', () => {
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        const options = currencySet!.options;

        const remaining = options.slice(3).map((o: any) => String(o.value));
        const sorted = [...remaining].sort((a, b) => a.localeCompare(b));
        expect(remaining).toEqual(sorted);
    });

    it('syncs iso-currencies.json with the seed options', () => {
        const jsonPath = path.resolve(__dirname, '../../../scripts/iso-currencies.json');
        const jsonRaw = fs.readFileSync(jsonPath, 'utf8');
        const jsonData = JSON.parse(jsonRaw);
        const currencySet = (OPTION_SETS as any[])?.find((s) => s.name === 'ISO_Currency_Code');
        expect(currencySet).toBeDefined();
        expect(jsonData).toEqual(currencySet!.options);
    });

    it('supports targeting ISO_Currency_Code specifically when filtering sets', () => {
        const targetName = 'ISO_Currency_Code';
        const filtered = (OPTION_SETS as any[]).filter((s) => s.name === targetName);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].name).toBe('ISO_Currency_Code');
    });
});
