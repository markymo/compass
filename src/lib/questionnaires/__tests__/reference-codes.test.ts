import { describe, expect, it } from 'vitest';
import { 
    normalizeCode,
    generateReferenceCodePrefix, 
    generateWorkingCopyTitle, 
    computeNextVersion 
} from '../reference-codes';

describe('reference-codes logic', () => {
    
    describe('normalizeCode', () => {
        it('removes spaces, punctuation, underscores and uppercases', () => {
            expect(normalizeCode("FMSB UK")).toBe("FMSBUK");
            expect(normalizeCode("kyc-onboarding!")).toBe("KYCONBOARDING");
            expect(normalizeCode("test_code_123")).toBe("TESTCODE123");
        });
    });

    describe('generateReferenceCodePrefix', () => {
        const testDate = new Date(Date.UTC(2026, 5, 5)); // June 5, 2026 -> YYMMDD = 260605

        it('system reference with both parties', () => {
            const prefix = generateReferenceCodePrefix({
                functionalCode: "FMSB",
                clientLeShortCode: "ACME",
                supplierShortCode: "STRIPE",
                isSystemQuestionnaire: true,
                date: testDate
            });
            expect(prefix).toBe("FMSB_260605_COPARITY_ACME_STRIPE");
        });

        it('non-system reference with both parties', () => {
            const prefix = generateReferenceCodePrefix({
                functionalCode: "FMSB",
                clientLeShortCode: "ACME",
                supplierShortCode: "STRIPE",
                isSystemQuestionnaire: false,
                date: testDate
            });
            expect(prefix).toBe("FMSB_260605_ACME_STRIPE");
        });

        it('missing client LE uses XXXXX', () => {
            const prefix = generateReferenceCodePrefix({
                functionalCode: "FMSB",
                clientLeShortCode: null,
                supplierShortCode: "STRIPE",
                isSystemQuestionnaire: false,
                date: testDate
            });
            expect(prefix).toBe("FMSB_260605_XXXXX_STRIPE");
        });

        it('missing supplier uses SSSSS', () => {
            const prefix = generateReferenceCodePrefix({
                functionalCode: "KYC",
                clientLeShortCode: "ACME",
                supplierShortCode: undefined,
                isSystemQuestionnaire: true,
                date: testDate
            });
            expect(prefix).toBe("KYC_260605_COPARITY_ACME_SSSSS");
        });

        it('both missing uses XXXXX and SSSSS', () => {
            const prefix = generateReferenceCodePrefix({
                functionalCode: "TEMPLATE",
                isSystemQuestionnaire: true,
                date: testDate
            });
            expect(prefix).toBe("TEMPLATE_260605_COPARITY_XXXXX_SSSSS");
        });

        it('functionalCode sanitisation occurs', () => {
            const prefix = generateReferenceCodePrefix({
                functionalCode: "AML/KYC!",
                clientLeShortCode: "acme inc",
                supplierShortCode: "stripe-llc",
                isSystemQuestionnaire: false,
                date: testDate
            });
            expect(prefix).toBe("AMLKYC_260605_ACMEINC_STRIPELLC");
        });
    });

    describe('generateWorkingCopyTitle', () => {
        it('working copy default title uses UNPUBLISHED and handles non-system', () => {
            const title = generateWorkingCopyTitle({
                functionalCode: "FMSB",
                clientLeShortCode: "ACME",
                supplierShortCode: "STRIPE",
                isSystemQuestionnaire: false,
            });
            expect(title).toBe("FMSB_UNPUBLISHED_ACME_STRIPE");
        });

        it('working copy default title with system questionnaire', () => {
            const title = generateWorkingCopyTitle({
                functionalCode: "FMSB",
                clientLeShortCode: "ACME",
                supplierShortCode: "STRIPE",
                isSystemQuestionnaire: true,
            });
            expect(title).toBe("FMSB_UNPUBLISHED_COPARITY_ACME_STRIPE");
        });

        it('working copy default title with missing parties', () => {
            const title = generateWorkingCopyTitle({
                functionalCode: "KYC-NEW",
            });
            expect(title).toBe("KYCNEW_UNPUBLISHED_XXXXX_SSSSS");
        });
    });

    describe('computeNextVersion', () => {
        const prefix = "FMSB_260605_COPARITY_ACME_STRIPE";

        it('version increment v1 when none exist', () => {
            expect(computeNextVersion(prefix, [])).toBe(1);
        });

        it('version increment v2 when v1 exists', () => {
            expect(computeNextVersion(prefix, [`${prefix}_v1`])).toBe(2);
        });

        it('version increment v10 -> v11', () => {
            expect(computeNextVersion(prefix, [
                `${prefix}_v1`,
                `${prefix}_v5`,
                `${prefix}_v10`,
                `${prefix}_v9`,
            ])).toBe(11);
        });

        it('malformed existing codes ignored', () => {
            expect(computeNextVersion(prefix, [
                `${prefix}_v1`,
                `${prefix}_vABC`,
                `${prefix}xxx_v20`,
                `OTHER_260605_ACME_STRIPE_v99`,
                `${prefix}_v`,
            ])).toBe(2);
        });
    });
});
