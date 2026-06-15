import prisma from '@/lib/prisma';
import { getFieldDefinition } from '@/domain/kyc/FieldDefinitions';
import { getMasterFieldGroup } from '@/services/masterData/definitionService';
import { ProvenanceSource } from '@/domain/kyc/types/ProvenanceTypes';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { isRenderableActiveDirectorParty } from '@/lib/master-data/party-value';

export type LoadedField = {
    value: any;
    source: ProvenanceSource | null;
    confidence: number | null;
    verifiedBy: string | null;
    updatedAt: Date | null;
};

export class KycLoader {

    /**
     * Loads a single field value from the Master Data.
     * Handles table resolution and traversal from ClientLE if needed.
     */
    async loadField(
        entityId: string,
        fieldNo: number,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<LoadedField | null> {
        // 1. Resolve Scope and Subject
        let subjectLeId = entityId;
        let ownerScopeId = null;

        if (entityType === 'CLIENT_LE') {
            const clientLE = await prisma.clientLE.findUnique({
                where: { id: entityId },
                select: { legalEntityId: true }
            });
            if (!clientLE?.legalEntityId) return null;
            subjectLeId = clientLE.legalEntityId;
            ownerScopeId = await KycStateService.resolveScopeId(entityId);
        }

        const def = getFieldDefinition(fieldNo);

        // 2. Fetch authoritative via Service
        if (def.isMultiValue || def.isRepeating) {
            let collection = await KycStateService.getAuthoritativeCollection(
                { subjectLeId },
                fieldNo,
                ownerScopeId || undefined
            );

            if (fieldNo === 63) {
                collection = collection.filter((c: any) => isRenderableActiveDirectorParty(c.value));
            }

            if (collection.length === 0) return null;

            // Summary for workbench
            const values = collection
                .map((d: any) => d.value)
                .filter((v: any) => v !== null && v !== undefined);

            const first = collection[0];
            return {
                value: values.join(", "),
                source: first.sourceType as ProvenanceSource || null,
                confidence: first.confidenceScore || null,
                verifiedBy: null,
                updatedAt: first.assertedAt
            };
        }

        const derived = await KycStateService.getAuthoritativeValue(
            { subjectLeId },
            fieldNo,
            ownerScopeId || undefined
        );

        if (!derived) return null;

        return {
            value: derived.value,
            source: derived.sourceType as ProvenanceSource || null,
            confidence: derived.confidenceScore || null,
            verifiedBy: null,
            updatedAt: derived.assertedAt
        };
    }

    /**
     * Loads all fields for a given Field Group.
     *
     * Reads group membership from the database (MasterFieldGroup + MasterFieldGroupItem).
     * getMasterFieldGroup() throws "Unknown or Inactive Field Group: X" if the key
     * is not found or the group is inactive — same error contract as before.
     *
     * Field ordering follows MasterFieldGroupItem.order (ascending), which is the
     * same ordering used by the questionnaire picker and propagation trigger.
     */
    async loadGroup(
        entityId: string,
        groupKey: string,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<Record<string, LoadedField | null>> {
        // DB-backed lookup — MasterFieldGroup is the sole source of truth for group membership.
        // FieldGroups.ts (hardcoded) is no longer read here.
        const group = await getMasterFieldGroup(groupKey);
        const fieldNos = group.items.map(item => item.fieldNo);

        const results: Record<string, LoadedField | null> = {};

        // Parallel fetch for all fields in group.
        // Optimization: Group fields by Model to reduce DB calls (Future)
        await Promise.all(fieldNos.map(async (fieldNo) => {
            const result = await this.loadField(entityId, fieldNo, entityType);
            results[fieldNo] = result;
        }));

        return results;
    }

    private getPrismaClientKey(modelName: string): string {
        return modelName.charAt(0).toLowerCase() + modelName.slice(1);
    }
}
