import prisma from "@/lib/prisma";
import { ClaimStatus, FieldClaim, Prisma } from "@prisma/client";

export type DerivedValue = {
    value: any;
    claimId: string;
    status: ClaimStatus;
    isScoped: boolean;
    sourceType: string;
    sourceReference?: string;
    evidenceProvider?: string;
    confidenceScore?: number;
    evidenceId?: string;
    instanceId?: string;
    collectionId?: string;
    assertedAt: Date;
};

export class KycStateService {
    /**
     * Resolves the default ownerScopeId for a ClientLE.
     * This is the partyId of its active ClientLEOwner.
     */
    static async resolveScopeId(clientLEId: string): Promise<string | null> {
        const owner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId, endAt: null },
            select: { partyId: true }
        });
        return owner?.partyId || null;
    }

    /**
     * Derives the authoritative value for a single-value field.
     */
    static async getAuthoritativeValue(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string },
        fieldNo: number,
        ownerScopeId?: string,
        snapshotDate?: Date
    ): Promise<DerivedValue | null> {
        // Comparison Set: (subject, fieldNo, ownerScopeId)
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true, valueAddress: true, valuePerson: true, valueLe: true, valueOrg: true },
            where: {
                fieldNo,
                ...subject,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] },
                assertedAt: snapshotDate ? { lte: snapshotDate } : undefined,
                OR: [
                    { ownerScopeId: ownerScopeId || undefined },
                    { ownerScopeId: null }
                ]
            },
            orderBy: [
                { assertedAt: 'desc' },
                { id: 'desc' }
            ]
        });

        if (claims.length === 0) return null;

        const winner = this.pickWinner(claims, ownerScopeId);
        if (!winner || this.isTombstone(winner)) return null;

        return this.mapToDerivedValue(winner, ownerScopeId);
    }

    /**
     * Derives a collection of values for a repeating field.
     */
    static async getAuthoritativeCollection(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string },
        fieldNo: number,
        ownerScopeId?: string,
        snapshotDate?: Date
    ): Promise<DerivedValue[]> {
        // Multi-value Comparison Set: (subject, fieldNo, ownerScopeId, collectionId, instanceId)
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true, valueAddress: true, valuePerson: true, valueLe: true, valueOrg: true },
            where: {
                fieldNo,
                ...subject,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] },
                assertedAt: snapshotDate ? { lte: snapshotDate } : undefined,
                OR: [
                    { ownerScopeId: ownerScopeId || undefined },
                    { ownerScopeId: null }
                ]
            },
            orderBy: [
                { assertedAt: 'desc' },
                { id: 'desc' }
            ]
        });

        // Group by collectionId and instanceId
        const itemGroups: Record<string, FieldClaim[]> = {};
        for (const c of claims) {
            const key = `${c.collectionId || 'default'}:${c.instanceId || 'default'}`;
            if (!itemGroups[key]) itemGroups[key] = [];
            itemGroups[key].push(c);
        }

        const results: DerivedValue[] = [];
        for (const key in itemGroups) {
            const winner = this.pickWinner(itemGroups[key], ownerScopeId);
            if (winner && !this.isTombstone(winner)) {
                results.push(this.mapToDerivedValue(winner, ownerScopeId));
            }
        }

        return results;
    }

    /**
     * The Selection Hierarchy / Comparison Set Rule:
     * 1. All VERIFIED in specific ownerScopeId.
     * 2. If (1) is empty, all VERIFIED in null (System Baseline).
     * 3. Winner is newest assertedAt within the winning tier.
     * 4. Fallback to ASSERTED if no VERIFIED exists (Scoped then Baseline).
     */
    private static pickWinner(claims: FieldClaim[], requestedScopeId?: string): FieldClaim | null {
        // 1. Filter by status and scope tiers
        // 2. Priority by source trust: GLEIF (1) > REGISTRATION_AUTHORITY (2) > USER_INPUT (3) > AI (4) > SYSTEM (5)
        // 3. Newest assertedAt
        // 4. Tie-breaker claim id desc

        const getSourcePriority = (source: string) => {
            if (source === 'GLEIF') return 1;
            if (source === 'REGISTRATION_AUTHORITY') return 2;
            if (source === 'USER_INPUT') return 3;
            if (source === 'AI_EXTRACTION') return 4;
            return 5;
        };

        const sortAndPick = (list: FieldClaim[]) => {
            if (list.length === 0) return null;
            return list.sort((a: any, b: any) => {
                // Source priority (asc because 1 is higher)
                const pA = getSourcePriority(a.sourceType);
                const pB = getSourcePriority(b.sourceType);
                if (pA !== pB) return pA - pB;

                // assertedAt desc
                const tA = a.assertedAt.getTime();
                const tB = b.assertedAt.getTime();
                if (tA !== tB) return tB - tA;

                // ID tie-breaker
                return b.id.localeCompare(a.id);
            })[0];
        };

        // Tier 1: VERIFIED Scoped
        if (requestedScopeId) {
            const verifiedScoped = claims.filter((c: any) => c.status === ClaimStatus.VERIFIED && c.ownerScopeId === requestedScopeId);
            const winner = sortAndPick(verifiedScoped);
            if (winner) return winner;
        }

        // Tier 2: ASSERTED Scoped
        if (requestedScopeId) {
            const assertedScoped = claims.filter((c: any) => c.status === ClaimStatus.ASSERTED && c.ownerScopeId === requestedScopeId);
            const winner = sortAndPick(assertedScoped);
            if (winner) return winner;
        }

        // Tier 3: VERIFIED Baseline
        const verifiedBaseline = claims.filter((c: any) => c.status === ClaimStatus.VERIFIED && c.ownerScopeId === null);
        const winnerV = sortAndPick(verifiedBaseline);
        if (winnerV) return winnerV;

        // Tier 4: ASSERTED Baseline
        const assertedBaseline = claims.filter((c: any) => c.status === ClaimStatus.ASSERTED && c.ownerScopeId === null);
        return sortAndPick(assertedBaseline);
    }

    private static isTombstone(claim: FieldClaim): boolean {
        // A tombstone is defined as a claim where valueJson is { "tombstone": true }
        // or all value fields are null (if we want to be more liberal).
        // For Phase 2.5, let's use the explicit JSON flag.
        if (claim.valueJson && typeof claim.valueJson === 'object') {
            const val = claim.valueJson as Record<string, any>;
            return val.tombstone === true;
        }
        return false;
    }

    private static mapToDerivedValue(claim: FieldClaim, requestedScopeId?: string): DerivedValue {
        const value = claim.valueText ??
            claim.valueNumber ??
            claim.valueDate ??
            claim.valueJson ??
            (claim as any).valueAddress ??
            (claim as any).valuePerson ??
            (claim as any).valueLe ??
            (claim as any).valueOrg ??
            claim.valueDocId;

        return {
            value,
            claimId: claim.id,
            status: claim.status,
            isScoped: claim.ownerScopeId === requestedScopeId && !!requestedScopeId,
            sourceType: claim.sourceType,
            sourceReference: claim.sourceReference ?? undefined,
            evidenceProvider: (claim as any).evidence?.provider ?? undefined,
            confidenceScore: claim.confidenceScore ?? undefined,
            evidenceId: claim.evidenceId ?? undefined,
            instanceId: claim.instanceId ?? undefined,
            collectionId: claim.collectionId ?? undefined,
            assertedAt: claim.assertedAt,
        };
    }
}
