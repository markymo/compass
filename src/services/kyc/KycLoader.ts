import prisma from '@/lib/prisma';
import { getFieldDefinition } from '@/domain/kyc/FieldDefinitions';
import { FIELD_GROUPS } from '@/domain/kyc/FieldGroups';
import { ProvenanceSource } from '@/domain/kyc/types/ProvenanceTypes';
import { KycStateService } from '@/lib/kyc/KycStateService';

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
            const collection = await KycStateService.getAuthoritativeCollection(
                { subjectLeId },
                fieldNo,
                ownerScopeId || undefined
            );

            if (collection.length === 0) return null;

            // Summary for workbench
            const values = collection
                .map(d => d.value)
                .filter(v => v !== null && v !== undefined);

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
     */
    async loadGroup(
        entityId: string,
        groupKey: string,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<Record<string, LoadedField | null>> {
        const group = FIELD_GROUPS[groupKey];
        if (!group) throw new Error(`Field Group ${groupKey} not found`);

        const results: Record<string, LoadedField | null> = {};

        // Parallel fetch for all fields in group
        // Optimization: Group fields by Model to reduce DB calls (Future)
        await Promise.all(group.fieldNos.map(async (fieldNo) => {
            const result = await this.loadField(entityId, fieldNo, entityType);
            results[fieldNo] = result;
        }));

        return results;
    }

    private getPrismaClientKey(modelName: string): string {
        return modelName.charAt(0).toLowerCase() + modelName.slice(1);
    }
}
