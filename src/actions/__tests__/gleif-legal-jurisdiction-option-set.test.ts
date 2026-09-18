import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { OPTION_SETS } from '../../../scripts/seed-option-sets';

describe('ONP-203 — GLEIF_Legal_Jurisdictions Option Set', () => {
    it('is registered in the OPTION_SETS seed configuration with official description and version 1.5', () => {
        const jurisdictionSet = (OPTION_SETS as any[])?.find((s) => s.name === 'GLEIF_Legal_Jurisdictions');
        expect(jurisdictionSet).toBeDefined();
        expect(jurisdictionSet?.valueType).toBe('STRING');
        expect(jurisdictionSet?.description).toContain('GLEIF Accepted Legal Jurisdictions Code List — Version 1.5');
        expect(Array.isArray(jurisdictionSet?.options)).toBe(true);
        expect(jurisdictionSet!.options.length).toBe(324);
    });

    it('contains exactly 324 unique codes from GLEIF v1.5 without duplicates or placeholders', () => {
        const jurisdictionSet = (OPTION_SETS as any[])?.find((s) => s.name === 'GLEIF_Legal_Jurisdictions');
        expect(jurisdictionSet).toBeDefined();
        const options = jurisdictionSet!.options;

        expect(options.length).toBe(324);
        const codes = options.map((o: any) => o.value);
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(324);
    });

    it('preserves raw authoritative codes as stored values (never label in value)', () => {
        const jurisdictionSet = (OPTION_SETS as any[])?.find((s) => s.name === 'GLEIF_Legal_Jurisdictions');
        expect(jurisdictionSet).toBeDefined();
        const options = jurisdictionSet!.options;

        for (const opt of options) {
            expect(typeof opt.value).toBe('string');
            // Codes are either ISO 3166-1 alpha-2 (e.g. GB) or ISO 3166-2 subdivision (e.g. US-DE, GB-SCT)
            expect(opt.value).toMatch(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/);
            // Must NOT contain dashes surrounded by spaces (i.e. not the label)
            expect(opt.value).not.toContain(' \u2013 ');
        }
    });

    it('formats all labels as "<code> – <GLEIF jurisdiction name>" with Unicode en-dash', () => {
        const jurisdictionSet = (OPTION_SETS as any[])?.find((s) => s.name === 'GLEIF_Legal_Jurisdictions');
        expect(jurisdictionSet).toBeDefined();
        const options = jurisdictionSet!.options;

        for (const opt of options) {
            expect(typeof opt.label).toBe('string');
            expect(opt.label).toContain(' \u2013 ');
            const [codePart, ...nameParts] = opt.label.split(' \u2013 ');
            expect(codePart).toBe(opt.value);
            const namePart = nameParts.join(' \u2013 ');
            expect(namePart.trim().length).toBeGreaterThan(0);
        }
    });

    it('contains representative country and subdivision entries with exact GLEIF names', () => {
        const jurisdictionSet = (OPTION_SETS as any[])?.find((s) => s.name === 'GLEIF_Legal_Jurisdictions');
        expect(jurisdictionSet).toBeDefined();
        const options = jurisdictionSet!.options;
        const map = new Map(options.map((o: any) => [o.value, o.label]));

        // GB (Country level)
        expect(map.get('GB')).toBe('GB \u2013 United Kingdom of Great Britain and Northern Ireland');

        // FR (Country level)
        expect(map.get('FR')).toBe('FR \u2013 France');

        // US-DE (US Subdivision)
        expect(map.get('US-DE')).toBe('US-DE \u2013 Delaware (United States of America)');

        // GB-SCT (UK Subdivision)
        expect(map.get('GB-SCT')).toBe('GB-SCT \u2013 Scotland (United Kingdom of Great Britain and Northern Ireland)');

        // CA-ON (Canadian Subdivision)
        expect(map.get('CA-ON')).toBe('CA-ON \u2013 Ontario (Canada)');
    });

    it('orders entries deterministically alphabetically by code localeCompare matching GLEIF v1.5', () => {
        const jurisdictionSet = (OPTION_SETS as any[])?.find((s) => s.name === 'GLEIF_Legal_Jurisdictions');
        expect(jurisdictionSet).toBeDefined();
        const options = jurisdictionSet!.options;

        const codes = options.map((o: any) => String(o.value));
        const sortedCodes = [...codes].sort((a, b) => a.localeCompare(b));
        expect(codes).toEqual(sortedCodes);
    });

    it('syncs gleif-legal-jurisdictions.json with the seed options', () => {
        const jsonPath = path.resolve(__dirname, '../../../scripts/gleif-legal-jurisdictions.json');
        const jsonRaw = fs.readFileSync(jsonPath, 'utf8');
        const jsonData = JSON.parse(jsonRaw);
        const jurisdictionSet = (OPTION_SETS as any[])?.find((s) => s.name === 'GLEIF_Legal_Jurisdictions');
        expect(jurisdictionSet).toBeDefined();
        expect(jsonData).toEqual(jurisdictionSet!.options);
    });

    it('supports targeting GLEIF_Legal_Jurisdictions specifically when filtering sets', () => {
        const requested = 'GLEIF_Legal_Jurisdictions';
        const filtered = OPTION_SETS.filter((s) => s.name === requested);
        expect(filtered.length).toBe(1);
        expect(filtered[0].name).toBe('GLEIF_Legal_Jurisdictions');
        expect(filtered[0].options.length).toBe(324);
    });
});
