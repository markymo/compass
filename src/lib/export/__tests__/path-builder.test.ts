import { describe, it, expect } from 'vitest';
import {
    sanitizeFilename,
    resolveDuplicate,
    buildOutputPackFilename,
    buildQuestionnairePdfPath,
    buildEvidencePath,
    buildGeneralEvidencePath
} from '../path-builder';

describe('path-builder', () => {
    describe('sanitizeFilename', () => {
        it('strips illegal characters', () => {
            expect(sanitizeFilename('file\\name/with:illegal*chars?.txt<|>')).toBe('file_name_with_illegal_chars_.txt');
        });

        it('replaces spaces with underscores', () => {
            expect(sanitizeFilename('my file name.pdf')).toBe('my_file_name.pdf');
        });

        it('deduplicates underscores', () => {
            expect(sanitizeFilename('my   file___name')).toBe('my_file_name');
        });

        it('handles empty or undefined', () => {
            expect(sanitizeFilename('')).toBe('unnamed');
            expect(sanitizeFilename('   ')).toBe('unnamed');
        });
    });

    describe('resolveDuplicate', () => {
        it('returns original if not in set', () => {
            const set = new Set<string>();
            expect(resolveDuplicate('file.pdf', set)).toBe('file.pdf');
            expect(set.has('file.pdf')).toBe(true);
        });

        it('appends deterministic counter if collision occurs', () => {
            const set = new Set<string>(['file.pdf']);
            expect(resolveDuplicate('file.pdf', set)).toBe('file_1.pdf');
            expect(set.has('file_1.pdf')).toBe(true);
            
            expect(resolveDuplicate('file.pdf', set)).toBe('file_2.pdf');
            expect(set.has('file_2.pdf')).toBe(true);
        });

        it('handles files without extensions', () => {
            const set = new Set<string>(['file']);
            expect(resolveDuplicate('file', set)).toBe('file_1');
        });
    });

    describe('buildOutputPackFilename', () => {
        it('formats the root pack filename with date', () => {
            const date = new Date('2026-05-15T12:00:00Z');
            expect(buildOutputPackFilename('Acme Corp', date)).toBe('Acme_Corp_Output_Pack_2026-05-15.zip');
        });
    });

    describe('build paths', () => {
        it('buildQuestionnairePdfPath', () => {
            expect(buildQuestionnairePdfPath('Due Diligence?')).toBe('Questionnaires/Due_Diligence.pdf');
        });

        it('buildEvidencePath', () => {
            expect(buildEvidencePath('Due Diligence', 'Q1', 'Board Resolution.pdf'))
                .toBe('Evidence/Due_Diligence/Q1_Board_Resolution.pdf');
        });

        it('buildGeneralEvidencePath', () => {
            expect(buildGeneralEvidencePath('Company Chart.png'))
                .toBe('Evidence/General/Company_Chart.png');
        });
    });
});
