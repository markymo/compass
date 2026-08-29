import { describe, it, expect } from 'vitest';
import { resolveFieldForDisplay } from '../field-interpreter';

// Contract: PARTY-06 — F274 party values are not truncated in canonical read-only display and mapped reuse
// Linear: ONP-21

describe('PARTY-06 / ONP-21 — F274 Party Non-Truncation Display Logic', () => {
    it('preserves full long names for person and organisation parties without truncation', () => {
        const longPersonName = {
            forenames: 'Alexander Maximilian Archibald',
            surname: 'Montgomery-Featherstonehaugh',
            partyType: 'PERSON',
            roles: [{ roleTitle: 'Senior Person with Significant Control', roleType: 'PSC' }],
            nationalities: ['British', 'Swiss'],
        };

        const longOrgName = {
            organisationName: 'Global Intercontinental Trans-Oceanic Shipping & Logistics Corporation Limited',
            partyType: 'ORGANISATION',
            jurisdiction: 'United Kingdom',
            registrationNumber: 'UK-998877665544332211',
            roles: [{ roleTitle: 'Corporate Shareholder', roleType: 'CORPORATE_PSC' }],
        };

        const rawValue = [longPersonName, longOrgName];
        const rawSource = {
            source: 'USER_INPUT',
            sourceCheckedAt: new Date('2026-08-29T12:00:00.000Z'),
            timestamp: new Date('2026-08-29T12:00:00.000Z'),
        };

        const metadata = {
            fieldNo: 274,
            label: 'Persons of significant control (other)',
            appDataType: 'PARTY',
            isMultiValue: true,
            defaultText: '',
            displayState: 'POPULATED' as const,
        };

        const resolved = resolveFieldForDisplay(rawValue, rawSource, metadata as any);

        expect(resolved.value.kind).toBe('collection');
        if (resolved.value.kind === 'collection') {
            expect(resolved.value.items).toHaveLength(2);
            // Assert no ellipsis or artificial clipping in canonical display values
            expect(JSON.stringify(resolved.value.items[0])).toContain('Montgomery-Featherstonehaugh');
            expect(JSON.stringify(resolved.value.items[0])).toContain('Alexander Maximilian Archibald');
            expect(JSON.stringify(resolved.value.items[1])).toContain('Global Intercontinental Trans-Oceanic Shipping & Logistics Corporation Limited');
        }
    });
});
