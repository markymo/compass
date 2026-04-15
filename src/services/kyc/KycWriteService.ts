import prisma from '@/lib/prisma';
import {
    getMasterFieldDefinition,
    listAllMasterFields,
    listAllMasterGroupsWithItems,
} from '@/services/masterData/definitionService';
import {
    ProvenanceMetadata,
    ProvenanceSource,
} from '@/domain/kyc/types/ProvenanceTypes';
import { createMetaEntry, MetaEntry } from '@/domain/kyc/schemas/MetaSchema';
import { Prisma } from '@prisma/client';
import { FieldCandidate } from './normalization/types';
import { KycLoader } from './KycLoader';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { SourceType, ClaimStatus } from '@prisma/client';

const loader = new KycLoader();

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
                confidence: candidate.confidence,
                reason: candidate.sourceKey // Map sourceKey to reason/sourceReference
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
        const def = await getMasterFieldDefinition(fieldNo);

        if (!def) {
            throw new Error(`Field ${fieldNo} not found in Master Schema.`);
        }

        const modelField = (def as any).modelField;

        if (def.appDataType === 'DOCUMENT_REF' && !modelField) {
            throw new Error(`Field ${fieldNo} is a document-only field. Use DocumentService.`);
        }

        if (!modelField) {
            throw new Error(`Field ${fieldNo} has no mapped column definition.`);
        }

        if (def.isMultiValue && !rowId) {
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

        // 3. Check for Idempotency (Material Change Check)
        const derived = await KycStateService.getAuthoritativeValue(
            { subjectLeId: resolvedEntityId },
            fieldNo
        );

        if (derived && this.valuesAreEqual(derived.value, value)) {
            console.log(`[KycWriteService] Idempotency check: Value identical for Field ${fieldNo}. Skipping claim assertion.`);
            return true; 
        }

        // 4. Emit FieldClaim for Provenance Tracking
        try {
            await FieldClaimService.assertClaim({
                fieldNo,
                subjectLeId: resolvedEntityId,
                valueText: typeof value === 'string' ? value : undefined,
                valueNumber: typeof value === 'number' ? value : undefined,
                valueDate: value instanceof Date ? value : undefined,
                valueJson: typeof value === 'object' && !(value instanceof Date) ? value : undefined,
                sourceType: (provenance.source as any) === 'USER_INPUT' ? SourceType.USER_INPUT :
                    (provenance.source as any) === 'GLEIF' ? SourceType.GLEIF :
                        (provenance.source as any) === 'REGISTRATION_AUTHORITY' ? SourceType.REGISTRATION_AUTHORITY :
                                SourceType.SYSTEM_DERIVED,
                sourceReference: provenance.reason,
                evidenceId: provenance.evidenceId,
                confidenceScore: provenance.confidence,
                status: (provenance as any).verifiedBy ? ClaimStatus.VERIFIED : ((provenance.source as any) === 'USER_INPUT' ? ClaimStatus.VERIFIED : ClaimStatus.ASSERTED),
                verifiedByUserId: (provenance as any).verifiedBy || (provenance as any).verified_by || undefined,
                assertedAt: new Date(),
                // Repeating Field Contract:
                collectionId: def.isMultiValue ? (def.categoryId || 'GENERAL') : undefined,
                instanceId: rowId || undefined
            });
        } catch (err) {
            console.error(`[KycWriteService] Failed to emit FieldClaim for field ${fieldNo}:`, err);
            // Don't fail the whole update if claim emission fails, but log it
        }

        // 5. Propagate to Questions
        // We await to ensure consistency for the user's immediate view.
        await this.propagateToQuestions(
            resolvedEntityId,
            fieldNo,
            value,
            provenance.verifiedBy || 'SYSTEM'
        );

        return true;
    }

    /**
     * Applies multiple overrides to a single record (repeating or 1:1).
     */
    async applyBulkOverride(
        entityId: string,
        modelName: string,
        updates: Record<string, any>, // { fieldName: value }
        reason: string,
        userId: string,
        rowId?: string,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
    ): Promise<boolean> {
        // 1. Resolve LegalEntity ID
        let resolvedEntityId = entityId;
        if (entityType === 'CLIENT_LE') {
            resolvedEntityId = await this.ensureLegalEntity(entityId);
        }

        // 2. Map fieldNames to fieldNos
        const allFields = await listAllMasterFields();
        const modelFields = allFields.filter((f: any) => f.masterDataCategory?.displayName === modelName);
        const nameToNo = new Map<string, number>();
        modelFields.forEach((def: any) => {
            if ((def as any).modelField) nameToNo.set((def as any).modelField, def.fieldNo);
        });

        // 3. Perform Update is now deprecated for legacy tables.
        // We rely entirely on individual FieldClaim assertions for data persistence.

        // 4. Propagate changes (sequential for now)
        for (const [fieldName, value] of Object.entries(updates)) {
            const fieldNo = nameToNo.get(fieldName);
            if (fieldNo) {
                await this.propagateToQuestions(resolvedEntityId, fieldNo, value, userId);
            }
        }

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
        userId: string,
        rowId?: string,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'CLIENT_LE'
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
            rowId,
            entityType
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
        rowId?: string,
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
                evidenceId: candidate.evidenceId || undefined,
                verifiedBy: userId,
                confidence: 1.0,
                reason: `Manual application of candidate from ${candidate.source}`
            },
            rowId,
            entityType
        );
    }


    /**
     * Ensures a LegalEntity record exists for a given ClientLE.
     * Creates logic: ClientLE <-(clientLEId)- IdentityProfile -(legalEntityId)-> LegalEntity
     */
    async ensureLegalEntity(clientLEId: string): Promise<string> {
        // 1. Check if ClientLE already has a direct link
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { legalEntityId: true }
        });

        if (clientLE?.legalEntityId) {
            return clientLE.legalEntityId;
        }

        // 2. Create and link directly
        return await prisma.$transaction(async (tx: any) => {
            const newLegalEntity = await tx.legalEntity.create({
                data: {
                    reference: `REF-${clientLEId.substring(0, 8).toUpperCase()}`,
                }
            });

            await tx.clientLE.update({
                where: { id: clientLEId },
                data: { legalEntityId: newLegalEntity.id }
            });

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
        const def = await getMasterFieldDefinition(candidate.fieldNo);

        // Resolve Entity ID/Type for Evaluation
        let evalEntityId = entityId;
        let evalEntityType = entityType; // 'LEGAL_ENTITY' or 'CLIENT_LE'

        // If CLIENT_LE, we need to bridge to LegalEntity for non-IdentityProfile models
        if (entityType === 'CLIENT_LE') {
            const clientLE = await prisma.clientLE.findUnique({
                where: { id: entityId },
                select: { legalEntityId: true }
            });

            if (clientLE?.legalEntityId) {
                evalEntityId = clientLE.legalEntityId;
                evalEntityType = 'LEGAL_ENTITY';
            } else {
                return {
                    action: 'PROPOSE_UPDATE',
                    reason: 'New record (Legal Entity will be created on write)',
                    currentValue: null,
                    currentSource: undefined
                };
            }
        }

        // 1. Fetch current state via KycStateService
        const derived = await KycStateService.getAuthoritativeValue(
            { subjectLeId: evalEntityId },
            candidate.fieldNo
        );

        const currentValue = derived?.value || null;
        const currentSource = derived?.sourceType;



        if (this.valuesAreEqual(currentValue, candidate.value)) {
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
            undefined, // preFetchedRecord (deprecated)
            evalEntityType
        );

        return {
            action: evaluation.allowed ? 'PROPOSE_UPDATE' : 'BLOCKED',
            reason: evaluation.reason,
            currentValue,
            currentSource: currentSource as ProvenanceSource
        };
    }

    private valuesAreEqual(a: any, b: any): boolean {
        if (a === b) return true;
        if (a instanceof Date && typeof b === 'string') {
            return a.toISOString().split('T')[0] === b.split('T')[0];
        }
        if (typeof a === 'string' && b instanceof Date) {
            return a.split('T')[0] === b.toISOString().split('T')[0];
        }
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }
        // For numbers/decimals
        if (typeof a === 'number' && typeof b === 'string') {
            return a === parseFloat(b);
        }
        return false;
    }

    private async evaluateOverwrite(
        entityId: string,
        def: any, // Use any to bypass FieldDefinition dependency
        incomingSource: ProvenanceSource,
        rowId?: string,
        preFetchedRecord?: any,
        entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY'
    ): Promise<{ allowed: boolean; reason: string }> {
        // Resolve authoritative state via KycStateService
        const derived = await KycStateService.getAuthoritativeValue(
            { subjectLeId: entityId },
            def.fieldNo
        );

        if (!derived) return { allowed: true, reason: 'No existing record' };

        const existingSource = derived.sourceType as ProvenanceSource;

        // RULE 1: User Input is sticky against automated feeds
        if (existingSource === 'USER_INPUT' && incomingSource === 'GLEIF') {
            return { allowed: false, reason: 'User manual override is protected from GLEIF updates' };
        }

        if (existingSource === 'USER_INPUT' && incomingSource === 'REGISTRATION_AUTHORITY') {
            return { allowed: false, reason: 'User manual override is protected from Registration Authority updates' };
        }

        // RULE 2: GLEIF is top tier for automated data
        if (existingSource === 'REGISTRATION_AUTHORITY' && incomingSource === 'GLEIF') {
            return { allowed: true, reason: 'GLEIF is authoritative over Registration Authority' };
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
        if (existingSource === 'GLEIF' && incomingSource === 'REGISTRATION_AUTHORITY') {
            return { allowed: false, reason: 'GLEIF is authoritative over Registration Authority' };
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
        // In the fully dynamic system, "creating a row" just means generating a new instanceId
        // and asserting the initial set of claims.
        // For now, we return a new UUID to be used as instanceId.
        return crypto.randomUUID();
    }
    /**
     * Propagates a Master Data change to all linked Questions in active Engagements.
     */
    private async propagateToQuestions(
        leId: string,
        fieldNo: number,
        newValue: any,
        actorId: string
    ) {
        // 1. Find directly mapped questions
        // @ts-ignore
        const directQuestions = await prisma.question.findMany({
            where: {
                masterFieldNo: fieldNo,
                questionnaire: {
                    // Ideally filtered by Active Engagements, but for now global for this LE
                    // Wait, questions don't have direct link to LE unless via QuestionnaireInstance -> Engagement -> LE
                    // OR via Questionnaire -> Engagement -> LE
                    // We need to trace back to THIS LE.
                    // Option A: Find Engagements for this LE, then find Questions in them.
                }
            },
            include: {
                questionnaire: {
                    include: {
                        fiEngagement: true // For Instance
                    }
                }
            }
        });

        // The query above is inefficient/hard because of the deep nesting and polymorphic reuse of Templates.
        // Better: Find Active Engagements for this LE, then find relevant Questions.

        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId: leId, status: { not: 'ARCHIVED' } },
            include: {
                // @ts-ignore
                questionnaireInstances: {
                    // @ts-ignore
                    include: { questions: { where: { masterFieldNo: fieldNo } } }
                },
                // @ts-ignore
                questionnaires: {
                    // @ts-ignore
                    include: { questions: { where: { masterFieldNo: fieldNo } } }
                }
            }
        });

        for (const eng of engagements) {
            const allQuestions = [
                ...eng.questionnaireInstances.flatMap((qi: any) => qi.questions),
                ...eng.questionnaires.flatMap((q: any) => q.questions)
            ];

            for (const q of allQuestions) {
                if (q.answer === newValue) continue; // No change needed

                await prisma.question.update({
                    where: { id: q.id },
                    data: {
                        answer: String(newValue), // Naive string conversion for now
                        status: 'DRAFT', // Auto-move to valid status
                    }
                });

                await prisma.questionActivity.create({
                    data: {
                        questionId: q.id,
                        userId: actorId, // Or a specific System User ID
                        type: 'AUTO_ANSWERED_BY_MASTER_DATA',
                        details: {
                            fieldNo,
                            value: newValue
                        }
                    }
                });
            }
        }

        // 2. Check for Group Propagation
        // If this field is part of a group, we must update questions mapped to that Group.
        const allGroupsWithItems = await listAllMasterGroupsWithItems();
        for (const group of allGroupsWithItems) {
            if (group.fieldNos.includes(fieldNo)) {
                await this.propagateGroupToQuestions(leId, group.key, actorId);
            }
        }
    }

    private async propagateGroupToQuestions(
        leId: string,
        groupId: string,
        actorId: string
    ) {
        // 1. Load full group data
        const groupData = await loader.loadGroup(leId, groupId, 'CLIENT_LE');

        // 2. Format Answer (JSON for now?)
        // The Question likely expects a specific format.
        // For simplicity, we jsonify the values: { fieldNo: value, ... }
        const answerPayload: Record<string, any> = {};
        for (const [fNo, val] of Object.entries(groupData)) {
            if (val && val.value !== null) {
                answerPayload[fNo] = val.value;
            }
        }
        const answerString = JSON.stringify(answerPayload, null, 2);

        // 3. Find Questions mapped to this Group
        const engagements = await prisma.fIEngagement.findMany({
            where: { clientLEId: leId, status: { not: 'ARCHIVED' } },
            include: {
                // @ts-ignore
                questionnaireInstances: {
                    // @ts-ignore
                    include: { questions: { where: { masterQuestionGroupId: groupId } } }
                },
                // @ts-ignore
                questionnaires: {
                    // @ts-ignore
                    include: { questions: { where: { masterQuestionGroupId: groupId } } }
                }
            }
        });

        for (const eng of engagements) {
            const allQuestions = [
                ...eng.questionnaireInstances.flatMap((qi: any) => qi.questions),
                ...eng.questionnaires.flatMap((q: any) => q.questions)
            ];

            for (const q of allQuestions) {
                if (q.answer === answerString) continue;

                await prisma.question.update({
                    where: { id: q.id },
                    data: {
                        status: 'DRAFT'
                    }
                });

                await prisma.questionActivity.create({
                    data: {
                        questionId: q.id,
                        userId: actorId,
                        type: 'AUTO_ANSWERED_BY_MASTER_DATA',
                        details: {
                            groupId,
                            value: answerPayload
                        }
                    }
                });
            }
        }
    }
}
