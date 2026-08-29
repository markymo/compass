import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshLocalRegistryData } from '../registry';
import { LegalEntityEnrichmentService } from '@/domain/registry';

// Contract: ENR-01 — Partial-source enrichment completes without blocking UX
// Linear: ONP-27

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn()
}));

vi.mock('@/domain/registry', () => ({
    LegalEntityEnrichmentService: {
        bootstrapEntity: vi.fn()
    }
}));

describe('ENR-01 / ONP-27 — Partial Enrichment Invariants', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('1. Partial failure returns error and warnings gracefully without throwing unhandled exceptions', async () => {
        (LegalEntityEnrichmentService.bootstrapEntity as any).mockResolvedValue({
            success: false,
            error: 'National registry CH not found',
            warnings: ['Skipped CH reference']
        });

        const res = await refreshLocalRegistryData('le-1');

        expect(res.success).toBe(false);
        expect(res.error).toBe('National registry CH not found');
        expect(res.warnings).toEqual(['Skipped CH reference']);
    });

    it('2. Successful enrichment revalidates master and registry routes', async () => {
        const { revalidatePath } = await import('next/cache');
        (LegalEntityEnrichmentService.bootstrapEntity as any).mockResolvedValue({
            success: true,
            warnings: []
        });

        const res = await refreshLocalRegistryData('le-2');

        expect(res.success).toBe(true);
        expect(revalidatePath).toHaveBeenCalledWith('/app/le/le-2/master');
        expect(revalidatePath).toHaveBeenCalledWith('/app/le/le-2/sources/registry');
    });
});
