import { FieldClaim } from '@prisma/client';

export interface InstanceAttachmentHistory {
    instanceId: string;
    fieldNo: number;
    currentDocumentId: string | null;
    isRemoved: boolean;
    events: FieldClaim[]; // Ordered oldest to newest
}

export class AttachmentLifecycleResolver {
    /**
     * Resolves the attachment history and current state for a set of claims.
     * Expects all claims to be of claimRole 'FILE_ATTACHMENT'.
     * Groups them by instanceId and determines the authoritative current document.
     */
    static resolveHistories(claims: FieldClaim[]): Map<string, InstanceAttachmentHistory> {
        // Group by instanceId
        const groups = new Map<string, FieldClaim[]>();
        for (const claim of claims) {
            const key = claim.instanceId || 'default';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(claim);
        }

        const histories = new Map<string, InstanceAttachmentHistory>();

        for (const [instanceId, groupClaims] of groups.entries()) {
            // Sort claims oldest to newest
            groupClaims.sort((a, b) => {
                const timeDiff = a.assertedAt.getTime() - b.assertedAt.getTime();
                if (timeDiff !== 0) return timeDiff;
                return a.id.localeCompare(b.id);
            });

            const latestClaim = groupClaims[groupClaims.length - 1];
            const isTombstone = this.isTombstone(latestClaim);

            histories.set(instanceId, {
                instanceId,
                fieldNo: latestClaim.fieldNo,
                currentDocumentId: isTombstone ? null : (latestClaim.attachmentDocumentId || null),
                isRemoved: isTombstone,
                events: groupClaims,
            });
        }

        return histories;
    }

    /**
     * A tombstone is defined as a claim where valueJson is { "tombstone": true }.
     */
    static isTombstone(claim: FieldClaim): boolean {
        if (claim.valueJson && typeof claim.valueJson === 'object') {
            const val = claim.valueJson as Record<string, any>;
            return val.tombstone === true;
        }
        return false;
    }
}
