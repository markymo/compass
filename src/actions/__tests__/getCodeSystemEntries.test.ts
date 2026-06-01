/**
 * getCodeSystemEntries.test.ts
 *
 * Unit tests for the getCodeSystemEntries server action.
 * Pure unit tests — no mocks needed. Operates directly on the static SIC data file.
 */

import { describe, it, expect } from 'vitest';
import { getCodeSystemEntries } from '../code-system';

describe('getCodeSystemEntries', () => {

    it('B1: SIC_2007_UK returns an array of { code, label } entries', async () => {
        const entries = await getCodeSystemEntries('SIC_2007_UK');
        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0]).toHaveProperty('code');
        expect(entries[0]).toHaveProperty('label');
    });

    it('B2: SIC_2007_UK returns 731 entries (full UK SIC 2007 dataset)', async () => {
        const entries = await getCodeSystemEntries('SIC_2007_UK');
        expect(entries).toHaveLength(731);
    });

    it('B3: code 35110 is present with the correct label', async () => {
        const entries = await getCodeSystemEntries('SIC_2007_UK');
        const sic = entries.find(e => e.code === '35110');
        expect(sic).toBeDefined();
        expect(sic!.label).toBe('Production of electricity');
    });

    it('B4: entries are sorted by code ascending', async () => {
        const entries = await getCodeSystemEntries('SIC_2007_UK');
        for (let i = 1; i < entries.length; i++) {
            expect(entries[i].code.localeCompare(entries[i - 1].code)).toBeGreaterThanOrEqual(0);
        }
    });

    it('B5: unknown code system returns an empty array', async () => {
        const entries = await getCodeSystemEntries('UNKNOWN_SYSTEM');
        expect(entries).toEqual([]);
    });

    it('B6: all entries have non-empty code and label strings', async () => {
        const entries = await getCodeSystemEntries('SIC_2007_UK');
        for (const entry of entries) {
            expect(typeof entry.code).toBe('string');
            expect(entry.code.length).toBeGreaterThan(0);
            expect(typeof entry.label).toBe('string');
            expect(entry.label.length).toBeGreaterThan(0);
        }
    });
});
