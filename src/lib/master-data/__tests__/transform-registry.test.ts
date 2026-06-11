/**
 * transform-registry.test.ts
 *
 * Verifies the completeness and consistency of the central transform definition registry.
 *
 * These tests are intentionally brittle on purpose: adding a new MappingTransformType
 * to the Prisma schema or transforms.ts should immediately cause a failure here,
 * prompting the developer to add the corresponding entry to transform-registry.ts.
 */
import { describe, it, expect } from 'vitest';
import {
    TRANSFORM_DEFINITIONS,
    TRANSFORM_DEFINITION_MAP,
    TRANSFORM_SELECT_OPTIONS,
    getTransformDescription,
} from '@/lib/master-data/transform-registry';

// ── The expected canonical set (mirrors MappingTransformType enum) ─────────────
const EXPECTED_KEYS = [
    'DIRECT',
    'DATE_TO_ISO',
    'DATETIME_TO_ISO',
    'COUNTRY_TO_NAME',
    'COUNTRY_TO_ISO2',
    'ENUM_MAP',
    'FIRST_ARRAY_ITEM',
    'JOIN_ARRAY',
    'TO_ADDRESS_OBJECT',
    'TO_PARTY_OBJECT',
    'TO_PARTY_LIST',
    'TO_NAME_HISTORY_LIST',
    'TO_CODE_LIST',
    'RA_CODE_TO_NAME',
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('transform-registry completeness', () => {

    it('TR-1: every expected MappingTransformType key has an entry', () => {
        for (const key of EXPECTED_KEYS) {
            expect(TRANSFORM_DEFINITION_MAP[key], `Missing entry for transform "${key}"`).toBeDefined();
        }
    });

    it('TR-2: no extra keys in the registry that are not in the known set', () => {
        const registryKeys = TRANSFORM_DEFINITIONS.map(d => d.key);
        for (const key of registryKeys) {
            expect(EXPECTED_KEYS, `Registry contains unknown transform "${key}"`).toContain(key);
        }
    });

    it('TR-3: every entry has a non-empty label and description', () => {
        for (const def of TRANSFORM_DEFINITIONS) {
            expect(def.label.trim().length, `Empty label for "${def.key}"`).toBeGreaterThan(0);
            expect(def.description.trim().length, `Empty description for "${def.key}"`).toBeGreaterThan(0);
        }
    });

    it('TR-4: TRANSFORM_SELECT_OPTIONS mirrors TRANSFORM_DEFINITIONS in order', () => {
        expect(TRANSFORM_SELECT_OPTIONS).toHaveLength(TRANSFORM_DEFINITIONS.length);
        TRANSFORM_SELECT_OPTIONS.forEach((opt, i) => {
            expect(opt.value).toBe(TRANSFORM_DEFINITIONS[i].key);
            expect(opt.label).toBe(TRANSFORM_DEFINITIONS[i].label);
        });
    });

    it('TR-5: getTransformDescription returns the right description for known keys', () => {
        expect(getTransformDescription('RA_CODE_TO_NAME')).toContain('RA000192');
        expect(getTransformDescription('COUNTRY_TO_NAME')).toContain('GB');
        expect(getTransformDescription('DIRECT')).toBeTruthy();
    });

    it('TR-6: getTransformDescription returns undefined for unknown keys', () => {
        expect(getTransformDescription('DOES_NOT_EXIST')).toBeUndefined();
    });

    it('TR-7: RA_CODE_TO_NAME description mentions registry_authorities', () => {
        const desc = getTransformDescription('RA_CODE_TO_NAME');
        expect(desc).toContain('Registry Authorities');
    });
});
