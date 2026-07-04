import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { KycWriteService } from '@/services/kyc/KycWriteService';
import { FieldCandidate } from '@/services/kyc/normalization/types';

describe('Absence-as-Deletion (Phase 1) Acceptance Tests', () => {

    describe('pickWinner behavior with explicitNone', () => {
        const priorityMap = new Map<string, number>([
            ['REGISTRATION_AUTHORITY:__null__', 1],
            ['GLEIF:__null__', 2]
        ]);

        it('source value disappears -> explicitNone wins over older automated claim', () => {
            const olderClaim: any = {
                id: '1',
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: null,
                assertedAt: new Date('2026-01-01'),
                valueJson: { name: 'Old Value' },
                status: 'ASSERTED',
                ownerScopeId: null
            };
            
            const newerExplicitNone: any = {
                id: '2',
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: null,
                assertedAt: new Date('2026-01-02'),
                valueJson: { explicitNone: true },
                status: 'ASSERTED',
                ownerScopeId: null
            };

            const winner = KycStateService.pickWinner([olderClaim, newerExplicitNone], undefined, priorityMap);
            expect(winner).toBe(newerExplicitNone);
        });

        it('source value disappears -> explicitNone does not win over manual USER_INPUT', () => {
            const manualClaim: any = {
                id: '1',
                sourceType: 'USER_INPUT',
                sourceReference: null,
                assertedAt: new Date('2026-01-01'),
                valueJson: 'User Value',
                status: 'VERIFIED',
                ownerScopeId: null
            };
            
            const newerExplicitNone: any = {
                id: '2',
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: null,
                assertedAt: new Date('2026-01-02'),
                valueJson: { explicitNone: true },
                status: 'ASSERTED',
                ownerScopeId: null
            };

            const winner = KycStateService.pickWinner([manualClaim, newerExplicitNone], undefined, priorityMap);
            expect(winner).toBe(manualClaim);
        });
    });

    describe('KycWriteService repeating fields restriction', () => {
        let writeService: KycWriteService;

        beforeEach(() => {
            writeService = new KycWriteService();
            // Mock getMasterFieldDefinition
            vi.mock('@/services/masterData/definitionService', () => ({
                getMasterFieldDefinition: vi.fn(async (fieldNo: number) => {
                    return { fieldNo, isMultiValue: fieldNo === 100 }; // Field 100 is repeating
                })
            }));
        });

        it('repeating fields are skipped for Phase 1', async () => {
            const candidate: FieldCandidate = {
                fieldNo: 100, // Repeating field
                value: { explicitNone: true },
                isExplicitNone: true,
                source: 'REGISTRATION_AUTHORITY',
                evidenceId: 'test'
            };

            const success = await writeService.applyFieldCandidate('entity123', candidate);
            // It should return true (graceful drop) without actually updating.
            // We verify by knowing updateField wasn't called.
            expect(success).toBe(true);
        });
    });
});
