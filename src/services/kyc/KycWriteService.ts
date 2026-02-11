import prisma from '@/lib/prisma';
import {
    getFieldDefinition,
    isDocumentOnlyField,
    type FieldDefinition
} from '@/domain/kyc/FieldDefinitions';
import {
    ProvenanceMetadata,
    ProvenanceSource,
    Meta
} from '@/domain/kyc/types/ProvenanceTypes';
import { validateMetaForFields, createMetaEntry, MetaEntry } from '@/domain/kyc/schemas/MetaSchema';
import { Prisma } from '@prisma/client';

export class KycWriteService {

    /**
     * Universal write method enforcing provenance invariant.
     * Updates a single field and its corresponding meta entry.
     */
    async updateField(
        legalEntityId: string,
        fieldNo: number,
        value: any,
        provenance: {
            source: ProvenanceSource;
            evidenceId?: string;
            verifiedBy?: string;
            confidence?: number;
        },
        rowId?: string // Required for repeating fields
    ): Promise<void> {
        const def = getFieldDefinition(fieldNo);

        // 1. Handle document-only fields (no column to update)
        if (isDocumentOnlyField(fieldNo)) {
            throw new Error(`Field ${fieldNo} is a document-only field. Use DocumentService to manage documents.`);
        }

        if (!def.field) {
            throw new Error(`Field ${fieldNo} has no mapped column definition.`);
        }

        // 2. Validate rowId for repeating fields
        if (def.isRepeating && !rowId) {
            throw new Error(`Field ${fieldNo} (${def.model}) is repeating and requires a rowId.`);
        }

        // 3. Perform update (Atomic transaction/operation preferred)
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const prismaClientKey = this.getPrismaClientKey(def.model);
            // @ts-ignore
            const delegate = tx[prismaClientKey];

            if (!delegate) {
                throw new Error(`Prisma delegate not found for model ${def.model}`);
            }

            // Fetch current record to get existing meta
            let record;
            if (def.isRepeating) {
                record = await delegate.findUnique({ where: { id: rowId } });
                if (!record) throw new Error(`Row ${rowId} not found for model ${def.model}`);
            } else {
                record = await delegate.findUnique({ where: { legalEntityId } });
            }

            // Prepare new meta entry
            const newMetaEntry = createMetaEntry(fieldNo, provenance.source, {
                evidence_id: provenance.evidenceId,
                verified_by: provenance.verifiedBy,
                confidence: provenance.confidence,
            });

            // Merge meta
            // Ensure existing meta is a valid object before spreading
            const currentMeta = (record?.meta && typeof record.meta === 'object' ? record.meta : {}) as Meta;
            const updatedMeta = {
                ...currentMeta,
                [def.field!]: newMetaEntry,
            };

            // Perform Update / Upsert
            if (def.isRepeating) {
                await delegate.update({
                    where: { id: rowId },
                    data: {
                        [def.field!]: value,
                        meta: updatedMeta,
                    },
                });
            } else {
                // 1:1 Profile - Upsert
                // For upsert, we need create data. If record exists, we merge meta. If not, we start fresh.
                const createMeta = { [def.field!]: newMetaEntry };

                if (record) {
                    await delegate.update({
                        where: { legalEntityId },
                        data: {
                            [def.field!]: value,
                            meta: updatedMeta,
                        },
                    });
                } else {
                    await delegate.create({
                        data: {
                            legalEntityId,
                            [def.field!]: value,
                            meta: createMeta,
                        },
                    });
                }
            }
        }); // End transaction
    }

    /**
     * Helper to get Prisma Client property name from Model name
     * e.g. 'IdentityProfile' -> 'identityProfile'
     */
    private getPrismaClientKey(modelName: string): string {
        // Assuming standard Prisma casing (camelCase model names on client)
        return modelName.charAt(0).toLowerCase() + modelName.slice(1);
    }

    /**
     * Create a new row for a repeating model (e.g. Stakeholder)
     */
    async createRepeatingRow(
        legalEntityId: string,
        modelName: string,
        initialData: Record<string, any>,
        initialMeta: Meta
    ): Promise<string> {
        const prismaClientKey = this.getPrismaClientKey(modelName);
        // @ts-ignore
        const delegate = prisma[prismaClientKey];

        if (!delegate) throw new Error(`Model ${modelName} not found`);

        const result = await delegate.create({
            data: {
                legalEntityId,
                ...initialData,
                meta: initialMeta,
            },
        });

        return result.id;
    }

    /**
      * Delete a row from a repeating model
      */
    async deleteRepeatingRow(modelName: string, rowId: string): Promise<void> {
        const prismaClientKey = this.getPrismaClientKey(modelName);
        // @ts-ignore
        const delegate = prisma[prismaClientKey];

        if (!delegate) throw new Error(`Model ${modelName} not found`);

        await delegate.delete({
            where: { id: rowId }
        });
    }
}
