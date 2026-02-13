import prisma from '@/lib/prisma';
import {
    getFieldDefinition,
    type FieldDefinition
} from '@/domain/kyc/FieldDefinitions';
import { FIELD_GROUPS } from '@/domain/kyc/FieldGroups';
import { ProvenanceSource } from '@/domain/kyc/types/ProvenanceTypes';
import { MetaEntry } from '@/domain/kyc/schemas/MetaSchema';

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
        const def = getFieldDefinition(fieldNo);
        if (!def.field) return null;

        // 1. Resolve to LegalEntity ID if needed
        let resolvedEntityId = entityId;
        if (entityType === 'CLIENT_LE' && def.model !== 'IdentityProfile') {
            // Traverse ClientLE -> IdentityProfile -> LegalEntity
            // @ts-ignore
            const identity = await prisma.identityProfile.findUnique({
                where: { clientLEId: entityId },
                select: { legalEntityId: true }
            });
            if (!identity?.legalEntityId) return null; // No linked LE yet
            resolvedEntityId = identity.legalEntityId;
        }

        // 2. Fetch Record
        // @ts-ignore
        const delegate = prisma[this.getPrismaClientKey(def.model)];
        if (!delegate) throw new Error(`Model ${def.model} not found`);

        const idField = entityType === 'CLIENT_LE' && def.model === 'IdentityProfile'
            ? 'clientLEId'
            : 'legalEntityId';

        // TODO: Handle Repeating Fields (requires rowId which isn't passed here)
        // For hydration of a "General" questionnaire, we might default to the "Primary" row? 
        // Or return all? For now, let's focus on 1:1 Profiles.
        if (def.isRepeating) {
            console.warn(`[KycLoader] Repeating field ${fieldNo} hydration not yet fully supported (needs row selection logic). returning null.`);
            return null;
        }

        const record = await delegate.findUnique({
            where: { [idField]: resolvedEntityId }
        });

        if (!record) return null;

        // 3. Extract Value & Meta
        const value = record[def.field];
        if (value === undefined || value === null) return null;

        const meta = (record.meta as Record<string, MetaEntry>)?.[def.field];

        return {
            value,
            source: meta?.source as ProvenanceSource || null,
            confidence: meta?.confidence || null,
            verifiedBy: meta?.verified_by || null,
            updatedAt: record.updatedAt || null // Assuming all profiles have updatedAt
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
