import prisma from '@/lib/prisma';
import {
    getFieldDefinition,
    isDocumentOnlyField,
    type FieldDefinition
} from '@/domain/kyc/FieldDefinitions';
import {
    ProvenanceMetadata,
    ProvenanceSource,
} from '@/domain/kyc/types/ProvenanceTypes';
import { createMetaEntry, MetaEntry } from '@/domain/kyc/schemas/MetaSchema';
import { Prisma } from '@prisma/client';
import { FieldCandidate } from './normalization/types';

export class KycWriteService {

    /**
     * Applies a normalized field candidate to the Master Data Schema.
     * Enforces strict overwrite rules based on source priority.
     */
    async applyFieldCandidate(
        entityId: string,
        candidate: FieldCandidate,
        userId?: string,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<boolean> {
        return this.updateField(
            entityId,
            candidate.fieldNo,
            candidate.value,
            {
                source: candidate.source,
                evidenceId: candidate.evidenceId || undefined,
                verifiedBy: userId,
                confidence: candidate.confidence
            },
            undefined, // rowId
            entityType
        );
    }

    /**
     * Universal write method enforcing provenance invariant and overwrite logic.
     */
    async updateField(
        entityId: string,
        fieldNo: number,
        value: any,
        provenance: {
            source: ProvenanceSource;
            evidenceId?: string;
            verifiedBy?: string;
            confidence?: number;
            reason?: string; // Added for Manual Override
        },
        rowId?: string, // Required for repeating fields
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<boolean> {
        const def = getFieldDefinition(fieldNo);

        if (isDocumentOnlyField(fieldNo)) {
            throw new Error(`Field ${fieldNo} is a document-only field. Use DocumentService.`);
        }

        if (!def.field) {
            throw new Error(`Field ${fieldNo} has no mapped column definition.`);
        }

        if (def.isRepeating && !rowId) {
            throw new Error(`Field ${fieldNo} is repeating and requires a rowId.`);
        }

        // 1. Resolve LegalEntity ID (Lazy Creation for ClientLE)
        let resolvedEntityId = entityId;
        let resolvedEntityType = entityType;

        if (entityType === 'CLIENT_LE') {
            resolvedEntityId = await this.ensureLegalEntity(entityId);
            resolvedEntityType = 'LEGAL_ENTITY';
        }

        const idField = 'legalEntityId'; // Always legalEntityId after resolution

        // 2. Check Overwrite Rules
        const evaluation = await this.evaluateOverwrite(
            resolvedEntityId,
            def,
            provenance.source,
            rowId,
            undefined,
            resolvedEntityType
        );

        if (!evaluation.allowed) {
            console.log(`[KycWriteService] Overwrite denied for Field ${fieldNo} (Source: ${provenance.source}). Reason: ${evaluation.reason}`);
            return false;
        }

        // 3. Perform Update (Atomic) with Master Data Event
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const prismaClientKey = this.getPrismaClientKey(def.model);
            // @ts-ignore
            const delegate = tx[prismaClientKey];

            // Fetch current record for meta merging AND old value for event log
            let record;
            if (def.isRepeating) {
                record = await delegate.findUnique({ where: { id: rowId } });
            } else {
                record = await delegate.findUnique({ where: { [idField]: resolvedEntityId } });
            }

            const oldValue = record ? record[def.field!] : null;

            // Create Master Data Event (Audit Log)
            // @ts-ignore
            await tx.masterDataEvent.create({
                data: {
                    legalEntityId: resolvedEntityId,
                    fieldNo: fieldNo,
                    oldValue: oldValue,
                    newValue: value,
                    source: provenance.source,
                    evidenceId: provenance.evidenceId,
                    actorId: provenance.verifiedBy || 'SYSTEM',
                    reason: provenance.reason
                }
            });

            // Create new meta entry
            const newMetaEntry = createMetaEntry(fieldNo, provenance.source, {
                evidence_id: provenance.evidenceId,
                verified_by: provenance.verifiedBy,
                confidence: provenance.confidence,
            });

            // Merge meta
            const currentMeta = (record?.meta && typeof record.meta === 'object' ? record.meta : {}) as Record<string, MetaEntry>;
            const updatedMeta = {
                ...currentMeta,
                [def.field!]: newMetaEntry,
            };

            if (def.isRepeating) {
                await delegate.update({
                    where: { id: rowId },
                    data: {
                        [def.field!]: value,
                        meta: updatedMeta,
                    },
                });
            } else {
                // Upsert for 1:1 Profile
                if (record) {
                    await delegate.update({
                        where: { [idField]: resolvedEntityId },
                        data: {
                            [def.field!]: value,
                            meta: updatedMeta,
                        },
                    });
                } else {
                    await delegate.create({
                        data: {
                            [idField]: resolvedEntityId,
                            [def.field!]: value,
                            meta: { [def.field!]: newMetaEntry },
                        },
                    });
                }
            }
        });

        return true;
    }

    /**
     * Applies a manual override from a user.
     * Enforces 'USER_INPUT' source and requires a reason.
     */
    async applyManualOverride(
        legalEntityId: string,
        fieldNo: number,
        value: any,
        reason: string,
        userId: string
    ): Promise<boolean> {
        return this.updateField(
            legalEntityId,
            fieldNo,
            value,
            {
                source: 'USER_INPUT',
                verifiedBy: userId,
                reason: reason,
                confidence: 1.0
            },
            undefined,
            'LEGAL_ENTITY' // Assuming passed ID is always LegalEntity ID (or handle ClientLE if needed?)
            // Actually, for safety, let's allow the caller to pass explicit entity Type or assume LE.
            // But the UI usually works with ClientLE ID if it's the "App" context.
            // Let's assume the caller resolves it or passes the correct ID.
            // Wait, if I pass ClientLE ID, I should pass 'CLIENT_LE'.
        );
    }

    /**
     * Applies a specific candidate as the current value.
     * Functions as "Revert to this value".
     */
    async applyCandidate(
        legalEntityId: string,
        candidate: FieldCandidate,
        userId: string,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<boolean> {
        // When a user manually applies a candidate, we treat it as a Manual Override (USER_INPUT).
        // This ensures it becomes "sticky" and won't be overwritten by subsequent automated feeds.
        // However, we preserve the evidenceId to maintain the link to the original source.

        return this.updateField(
            legalEntityId,
            candidate.fieldNo,
            candidate.value,
            {
                source: 'USER_INPUT',
                evidenceId: candidate.evidenceId,
                verifiedBy: userId,
                confidence: 1.0,
                reason: `Manual application of candidate from ${candidate.source}`
            },
            undefined,
            entityType
        );
    }


    /**
     * Ensures a LegalEntity record exists for a given ClientLE.
     * Creates logic: ClientLE <-(clientLEId)- IdentityProfile -(legalEntityId)-> LegalEntity
     */
    async ensureLegalEntity(clientLEId: string): Promise<string> {
        // 1. Check if IdentityProfile exists for this ClientLE
        // @ts-ignore
        const identityProfile = await prisma.identityProfile.findUnique({
            where: { clientLEId }
        });

        // 2. If IdentityProfile exists and has legalEntityId, return it
        if (identityProfile && identityProfile.legalEntityId) {
            return identityProfile.legalEntityId;
        }

        // 3. If no IdentityProfile or no legalEntityId, we need to create/link
        return await prisma.$transaction(async (tx) => {
            // Create new LegalEntity
            // We need a reference. Use ClientLE name or fallback to ID if we can't easily fetch name here.
            // For now, generate a reference.
            // @ts-ignore
            const newLegalEntity = await tx.legalEntity.create({
                data: {
                    reference: `REF-${clientLEId.substring(0, 8).toUpperCase()}`, // Temporary reference
                }
            });

            if (identityProfile) {
                // Link existing IdentityProfile
                // @ts-ignore
                await tx.identityProfile.update({
                    where: { id: identityProfile.id },
                    data: { legalEntityId: newLegalEntity.id }
                });
            } else {
                // Create new IdentityProfile linking both
                // @ts-ignore
                await tx.identityProfile.create({
                    data: {
                        clientLEId: clientLEId,
                        legalEntityId: newLegalEntity.id
                    }
                });
            }

            return newLegalEntity.id;
        });
    }

    /**
     * Evaluates a candidate against the current state to determine the appropriate action.
     * Returns a FieldProposal with status (NO_CHANGE, PROPOSE_UPDATE, BLOCKED).
     */
    async evaluateFieldCandidate(
        entityId: string,
        candidate: FieldCandidate,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<{
        action: 'NO_CHANGE' | 'PROPOSE_UPDATE' | 'BLOCKED';
        reason?: string;
        currentValue?: any;
        currentSource?: ProvenanceSource;
    }> {
        const def = getFieldDefinition(candidate.fieldNo);

        // Resolve Entity ID/Type for Evaluation
        let evalEntityId = entityId;
        let evalEntityType = entityType; // 'LEGAL_ENTITY' or 'CLIENT_LE'

        // If CLIENT_LE, we need to bridge to LegalEntity for non-IdentityProfile models
        if (entityType === 'CLIENT_LE' && def.model !== 'IdentityProfile') {
            // Try to find linked IdentityProfile to get legalEntityId
            // @ts-ignore
            const identity = await prisma.identityProfile.findUnique({ where: { clientLEId: entityId } });

            if (identity && identity.legalEntityId) {
                evalEntityId = identity.legalEntityId;
                evalEntityType = 'LEGAL_ENTITY';
            } else {
                // No LegalEntity link exists yet.
                // This means the target profile (e.g. EntityInfo) surely doesn't exist.
                // We can skip the DB lookup and return PROPOSE_UPDATE (unless rule blocked? No, rules need current value)
                // Treat as "No Record"
                return {
                    action: 'PROPOSE_UPDATE',
                    reason: 'New record (Legal Entity will be created on write)',
                    currentValue: null,
                    currentSource: undefined
                };
            }
        }

        // Fetch current state
        const prismaClientKey = this.getPrismaClientKey(def.model);
        // @ts-ignore
        const delegate = prisma[prismaClientKey];
        const idField = evalEntityType === 'CLIENT_LE' ? 'clientLEId' : 'legalEntityId';

        let record;
        if (def.isRepeating) {
            return { action: 'BLOCKED', reason: 'Repeating field evaluation not yet supported' };
        } else {
            record = await delegate.findUnique({ where: { [idField]: evalEntityId } });
        }

        const currentMeta = (record?.meta as Record<string, MetaEntry>) || {};
        const fieldMeta = currentMeta[def.field!];
        const currentValue = record ? record[def.field!] : null;
        const currentSource = fieldMeta?.source;

        // 1. Check if values are identical
        if (record && record[def.field!] === candidate.value) {
            return {
                action: 'NO_CHANGE',
                currentValue,
                currentSource: currentSource as ProvenanceSource,
                reason: 'Values are identical'
            };
        }

        // 2. Evaluate Overwrite Rules
        const evaluation = await this.evaluateOverwrite(
            evalEntityId,
            def,
            candidate.source,
            undefined, // rowId
            record,
            evalEntityType
        );

        return {
            action: evaluation.allowed ? 'PROPOSE_UPDATE' : 'BLOCKED',
            reason: evaluation.reason,
            currentValue,
            currentSource: currentSource as ProvenanceSource
        };
    }

    private async evaluateOverwrite(
        entityId: string,
        def: FieldDefinition,
        incomingSource: ProvenanceSource,
        rowId?: string,
        preFetchedRecord?: any,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<{ allowed: boolean; reason: string }> {
        let record = preFetchedRecord;
        const idField = entityType === 'CLIENT_LE' ? 'clientLEId' : 'legalEntityId';

        if (!record) {
            const prismaClientKey = this.getPrismaClientKey(def.model);
            // @ts-ignore
            const delegate = prisma[prismaClientKey];
            if (def.isRepeating) {
                record = await delegate.findUnique({ where: { id: rowId } });
            } else {
                record = await delegate.findUnique({ where: { [idField]: entityId } });
            }
        }

        if (!record) return { allowed: true, reason: 'No existing record' };

        const currentMeta = (record.meta as Record<string, MetaEntry>) || {};
        const fieldMeta = currentMeta[def.field!];

        if (!fieldMeta) return { allowed: true, reason: 'No existing metadata' };

        const existingSource = fieldMeta.source as ProvenanceSource;

        // RULE 1: User Input is sticky against automated feeds
        if (existingSource === 'USER_INPUT' && incomingSource === 'GLEIF') {
            return { allowed: false, reason: 'User manual override is protected from GLEIF updates' };
        }

        if (existingSource === 'USER_INPUT' && incomingSource === 'COMPANIES_HOUSE') {
            return { allowed: false, reason: 'User manual override is protected from Local Registry updates' };
        }

        // RULE 2: GLEIF is top tier for automated data
        if (existingSource === 'COMPANIES_HOUSE' && incomingSource === 'GLEIF') {
            return { allowed: true, reason: 'GLEIF is authoritative over Local Registry' };
        }

        // RULE 3: User can always override
        if (incomingSource === 'USER_INPUT') {
            return { allowed: true, reason: 'User override' };
        }

        // RULE 4: Same source updates
        if (existingSource === incomingSource) {
            return { allowed: true, reason: 'Same source update' };
        }

        // Default: Deny to be safe? Or Allow?
        if (existingSource === 'GLEIF' && incomingSource === 'COMPANIES_HOUSE') {
            return { allowed: false, reason: 'GLEIF is authoritative over Local Registry' };
        }

        return { allowed: true, reason: 'Update allowed' };
    }

    private getPrismaClientKey(modelName: string): string {
        return modelName.charAt(0).toLowerCase() + modelName.slice(1);
    }

    async createRepeatingRow(
        entityId: string,
        modelName: string,
        initialData: Record<string, any>,
        initialMeta: any,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<string> {
        const prismaClientKey = this.getPrismaClientKey(modelName);
        // @ts-ignore
        const delegate = prisma[prismaClientKey];
        if (!delegate) throw new Error(`Model ${modelName} not found`);

        const idField = entityType === 'CLIENT_LE' ? 'clientLEId' : 'legalEntityId';

        const result = await delegate.create({
            data: {
                [idField]: entityId,
                ...initialData,
                meta: initialMeta,
            },
        });
        return result.id;
    }
}
