import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveExportAnswer } from '../export-answer-resolver';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { getFieldDetail } from '@/actions/kyc-query';
import prisma from '@/lib/prisma';

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        getAuthoritativeValue: vi.fn(),
        getAuthoritativeCollection: vi.fn(),
    }
}));

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
    enrichPartyReferences: vi.fn().mockImplementation(async (arr) => {
        for (const item of arr) {
            if (item?.ccPartyId) item._resolvedData = { ccParty: { data: { name: `Mocked Party ${item.ccPartyId}` } } };
        }
    }),
    enrichAddressReferences: vi.fn().mockImplementation(async (arr) => {
        for (const item of arr) {
            if (item?.ccAddressId) item._resolvedData = { ccAddress: { data: { addressLines: [`Mocked Address ${item.ccAddressId}`] } } };
        }
    }),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        fieldClaim: {
            findUnique: vi.fn()
        }
    }
}));

describe('Export Answer Resolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Provide a default mock for getFieldDetail to prevent undefined crashes
        vi.mocked(getFieldDetail).mockResolvedValue({
            dataType: 'string',
            profileConfig: {}
        } as any);
    });

    it('1. released mapped answer uses snapshotDate to remain frozen', async () => {
        const question = {
            status: 'RELEASED',
            releasedAt: new Date('2026-01-01T00:00:00Z'),
            masterFieldNo: 100,
            answer: null
        };
        
        vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({ value: "Frozen Value" } as any);
        
        const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
        
        expect(KycStateService.getAuthoritativeValue).toHaveBeenCalledWith(
            { subjectLeId: "le-1", clientLEId: "entity-1" },
            100,
            "scope-1",
            question.releasedAt
        );
        expect(res.displayValue).toBe("Frozen Value");
    });

    describe('Provenance rules', () => {
        const fixedDate = new Date('2026-06-22T12:00:00Z');

        it('1. GLEIF value includes Source: GLEIF and timestamp', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: "Value",
                sourceType: 'GLEIF',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("GLEIF");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('2. Companies House includes registry label and timestamp', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: "Value",
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: 'COMPANIES_HOUSE',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("Companies House");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('3. USER_INPUT value includes user metadata', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: "Value",
                sourceType: 'USER_INPUT',
                claimId: 'claim-123',
                assertedAt: fixedDate
            } as any);

            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-123',
                verifiedBy: { name: 'Alice Smith' }
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("User input — Alice Smith");
            expect(res.sourceUserName).toBe("Alice Smith");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('4. released default shows releasing user and release timestamp', async () => {
            const question = { 
                status: 'RELEASED', 
                masterFieldNo: 100,
                releasedAt: fixedDate,
                releasedByUser: { name: "Bob Jones" }
            };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'DEFAULT_RESPONSE',
                defaultResponse: "Fallback"
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("Released by Bob Jones");
            expect(res.sourceTimestamp).toBe(fixedDate);
            expect(res.sourceUserName).toBe("Bob Jones");
        });

        it('5. unreleased default shows Field default', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'DEFAULT_RESPONSE',
                defaultResponse: "Fallback"
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBe("Field default");
            expect(res.sourceTimestamp).toBe(null);
        });

        it('6. source checked absence shows source/timestamp', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'CHECKED_NO_DATA',
                current: { source: 'COMPANIES_HOUSE', timestamp: fixedDate }
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.displayValue).toBe("None");
            expect(res.sourceLabel).toBe("Companies House");
            expect(res.sourceTimestamp).toBe(fixedDate);
        });

        it('7. released explicit None shows releasing user/timestamp', async () => {
            const question = { 
                status: 'RELEASED', 
                masterFieldNo: 100,
                releasedAt: fixedDate,
                releasedByUser: { name: "Charlie" }
            };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: { explicitNone: true },
                sourceType: 'USER_INPUT',
                claimId: 'claim-123',
                assertedAt: fixedDate
            } as any);

            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-123',
                verifiedBy: { name: 'Charlie' }
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.displayValue).toBe("None");
            expect(res.sourceLabel).toBe("User input — Charlie");
            expect(res.sourceTimestamp).toBe(fixedDate.toISOString());
        });

        it('8. direct unmapped answer shows questionnaire/release provenance', async () => {
            const questionDraft = { answer: "Draft Answer", updatedAt: fixedDate };
            const resDraft = await resolveExportAnswer(questionDraft, "le-1", "scope-1", "entity-1");
            expect(resDraft.sourceLabel).toBe("Questionnaire answer");
            expect(resDraft.sourceTimestamp).toBe(fixedDate);

            const questionReleased = { 
                answer: "Released Answer", 
                status: 'RELEASED', 
                releasedAt: fixedDate,
                releasedByUser: { name: "Diana" }
            };
            const resReleased = await resolveExportAnswer(questionReleased, "le-1", "scope-1", "entity-1");
            expect(resReleased.sourceLabel).toBe("Released by Diana");
            expect(resReleased.sourceTimestamp).toBe(fixedDate);
        });

        it('9. no response recorded has no misleading source', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 100 };
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue(null);
            vi.mocked(getFieldDetail).mockResolvedValue({
                displayState: 'UNMAPPED_NO_RESPONSE'
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            expect(res.sourceLabel).toBeUndefined();
            expect(res.sourceTimestamp).toBeUndefined();
        });

        it('10. repeating field uses getAuthoritativeCollection and exports multiple resolved items', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 63 };
            
            vi.mocked(getFieldDetail).mockResolvedValue({
                isRepeating: true,
                dataType: 'PARTY'
            } as any);
    
            const fixedDate = new Date('2026-06-22T12:00:00Z');
            
            vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
                { value: { ccPartyId: 'p1' }, sourceType: 'USER_INPUT', claimId: 'claim-1', assertedAt: fixedDate },
                { value: { ccPartyId: 'p2' }, sourceType: 'USER_INPUT', claimId: 'claim-2', assertedAt: fixedDate }
            ] as any);
    
            vi.mocked(prisma.fieldClaim.findUnique).mockResolvedValue({
                id: 'claim-1',
                verifiedBy: { name: 'Alice Smith' }
            } as any);
    
            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            expect(KycStateService.getAuthoritativeCollection).toHaveBeenCalled();
            expect(KycStateService.getAuthoritativeValue).not.toHaveBeenCalled();
            expect(res.displayValue).toBe("• Mocked Party p1\n• Mocked Party p2");
            expect(res.sourceLabel).toBe("User input — Alice Smith"); // Pulled from primary claim (first item)
        });

        it('11. mapped address field stringified JSON is parsed before enrichment so it formats correctly', async () => {
            const question = { status: 'DRAFT', masterFieldNo: 15 };
            vi.mocked(getFieldDetail).mockResolvedValue({
                isRepeating: false,
                dataType: 'ADDRESS'
            } as any);

            const fixedDate = new Date('2026-06-22T12:00:00Z');
            
            // Simulating KycStateService returning the value as a stringified JSON (the bug condition)
            vi.mocked(KycStateService.getAuthoritativeValue).mockResolvedValue({
                value: JSON.stringify({ ccAddressId: 'addr-123' }),
                sourceType: 'COMPANIES_HOUSE',
                assertedAt: fixedDate
            } as any);

            const res = await resolveExportAnswer(question, "le-1", "scope-1", "entity-1");
            
            // Should be the enriched address, not ID:addr-123...
            expect(res.displayValue).toBe("Mocked Address addr-123");
        });
    });
});
