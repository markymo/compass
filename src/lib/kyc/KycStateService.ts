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
        ownerScopeId?: string
    ): Promise<DerivedValue | null> {
        // Comparison Set: (subject, fieldNo, ownerScopeId)
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true },
            where: {
                fieldNo,
                ...subject,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] },
                OR: [
                    { ownerScopeId: ownerScopeId || undefined },
                    { ownerScopeId: null }
                ]
            },
            orderBy: { assertedAt: 'desc' }
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
        ownerScopeId?: string
    ): Promise<DerivedValue[]> {
        // Multi-value Comparison Set: (subject, fieldNo, ownerScopeId, collectionId, instanceId)
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true },
            where: {
                fieldNo,
                ...subject,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] },
                OR: [
                    { ownerScopeId: ownerScopeId || undefined },
                    { ownerScopeId: null }
                ]
            },
            orderBy: { assertedAt: 'desc' }
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
        // Tier 1: VERIFIED Scoped
        if (requestedScopeId) {
            const verifiedScoped = claims.filter(c => c.status === ClaimStatus.VERIFIED && c.ownerScopeId === requestedScopeId);
            if (verifiedScoped.length > 0) return verifiedScoped[0]; // Already sorted by assertedAt desc
        }

        // Tier 2: ASSERTED Scoped
        if (requestedScopeId) {
            const assertedScoped = claims.filter(c => c.status === ClaimStatus.ASSERTED && c.ownerScopeId === requestedScopeId);
            if (assertedScoped.length > 0) return assertedScoped[0];
        }

        // Tier 3: VERIFIED Baseline
        const verifiedBaseline = claims.filter(c => c.status === ClaimStatus.VERIFIED && c.ownerScopeId === null);
        if (verifiedBaseline.length > 0) return verifiedBaseline[0];

        // Tier 4: ASSERTED Baseline
        const assertedBaseline = claims.filter(c => c.status === ClaimStatus.ASSERTED && c.ownerScopeId === null);
        if (assertedBaseline.length > 0) return assertedBaseline[0];

        return null;
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
            claim.valuePersonId ??
            claim.valueLeId ??
            claim.valueOrgId ??
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
