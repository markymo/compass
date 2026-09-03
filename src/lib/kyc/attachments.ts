import { DerivedValue } from "@/lib/kyc/KycStateService";
import { ResolvedAttachment } from "@/lib/master-data/field-display-model";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { CCPartyDocumentService } from "@/lib/documents/party/CCPartyDocumentService";
import { extractCanonicalPartyIds, getPartyName } from "@/lib/master-data/party-value";
import { isFieldPermittedByCatalogue } from "@/lib/master-data/party-display-catalogue";

/**
 * Legacy mapper for purely field-derived attachments.
 */
export function mapDerivedAttachments(derivedAttachments: DerivedValue[]): ResolvedAttachment[] {
    return derivedAttachments
        .filter((att): att is DerivedValue & { instanceId: string; attachmentDocumentId: string } => 
            att.instanceId !== undefined && att.attachmentDocumentId !== undefined)
        .map(att => ({
            documentId: att.attachmentDocumentId,
            displayName: att.documentName || 'Unknown Document',
            mimeType: att.documentMimeType || null,
            sizeBytes: att.documentSizeBytes || null,
            lifecycleCreatedAt: att.assertedAt.toISOString(),
            currentDocumentCreatedAt: att.documentCreatedAt?.toISOString() || att.assertedAt.toISOString(),
            uploadedBy: att.documentUploadedBy ? { displayName: att.documentUploadedBy } : undefined,
            provenance: [{
                type: 'FIELD_CLAIM',
                claimId: att.claimId,
                fieldNo: att.fieldNo,
                assertedAt: att.assertedAt.toISOString(),
                sourceType: att.sourceType,
                sourceReference: att.sourceReference || null,
                userName: att.documentUploadedBy || null
            }]
        }));
}

/**
 * Shared canonical attachment pipeline.
 * Resolves active FILE_ATTACHMENT claims AND CCPartyDocument attachments,
 * deduplicates them by documentId, and produces a deterministic provenance.
 */
export async function resolveAmalgamatedAttachments(
    subject: { subjectLeId?: string | null; subjectPersonId?: string | null; subjectOrgId?: string | null; clientLEId?: string },
    fieldNos: number[],
    resolvedValuesMap: Map<number, DerivedValue | DerivedValue[] | null>,
    fieldDefsMap?: Map<number, { allowAttachments?: boolean; profileConfig?: { displayMask?: string[] } }>
): Promise<Map<number, ResolvedAttachment[]>> {
    const result = new Map<number, ResolvedAttachment[]>();
    if (fieldNos.length === 0) return result;

    // 1. Resolve direct field attachments (historic evidence remains visible regardless of current write policy)
    const fieldAttachmentsMap = await KycStateService.resolveAllAttachments(subject, fieldNos);

    // 2. Extract ccPartyIds from the active field values (only if displayMask permits party.documents)
    const allPartyIds = new Set<string>();
    const fieldPartyIdMap = new Map<number, Set<string>>(); // fieldNo -> partyIds
    
    for (const fieldNo of fieldNos) {
        const mask = fieldDefsMap?.get(fieldNo)?.profileConfig?.displayMask;
        const permitsPartyDocs = isFieldPermittedByCatalogue('party.documents', mask);
        if (!permitsPartyDocs) continue;

        const valueOrColl = resolvedValuesMap.get(fieldNo);
        if (!valueOrColl) continue;
        
        const claims = Array.isArray(valueOrColl) ? valueOrColl : [valueOrColl];
        const partyIdsForField = new Set<string>();
        
        for (const claim of claims) {
            const targetVal = (claim && typeof claim === 'object' && 'value' in claim && claim.value !== undefined) ? claim.value : claim;
            const extracted = extractCanonicalPartyIds(targetVal);
            extracted.forEach(id => {
                allPartyIds.add(id);
                partyIdsForField.add(id);
            });
        }
        if (partyIdsForField.size > 0) {
            fieldPartyIdMap.set(fieldNo, partyIdsForField);
        }
    }

    // 3. Resolve active party documents
    const partyDocsMap = allPartyIds.size > 0
        ? await CCPartyDocumentService.resolvePartyDocumentsBatch(
            Array.from(allPartyIds),
            subject.clientLEId
        )
        : new Map();

    // 4. Amalgamate and deduplicate per field
    for (const fieldNo of fieldNos) {
        const rawAttachments = fieldAttachmentsMap.get(fieldNo) || [];
        const partyIdsInField = fieldPartyIdMap.get(fieldNo) || new Set<string>();
        
        const dedupMap = new Map<string, ResolvedAttachment>();

        // Add direct field attachments
        for (const att of rawAttachments) {
            if (!att.instanceId || !att.attachmentDocumentId) continue;
            
            const docId = att.attachmentDocumentId;
            if (!dedupMap.has(docId)) {
                dedupMap.set(docId, {
                    documentId: docId,
                    displayName: att.documentName || 'Unknown Document',
                    mimeType: att.documentMimeType || null,
                    sizeBytes: att.documentSizeBytes || null,
                    lifecycleCreatedAt: att.assertedAt.toISOString(),
                    currentDocumentCreatedAt: att.documentCreatedAt?.toISOString() || att.assertedAt.toISOString(),
                    uploadedBy: att.documentUploadedBy ? { displayName: att.documentUploadedBy } : undefined,
                    provenance: []
                });
            }
            
            const attachment = dedupMap.get(docId)!;
            if (!attachment.provenance.some(p => p.type === 'FIELD' && p.fieldAttachmentInstanceId === att.instanceId)) {
                attachment.provenance.push({
                    type: 'FIELD',
                    fieldNo,
                    fieldAttachmentInstanceId: att.instanceId
                });
            }
        }

        // Add party inherited attachments
        for (const partyId of partyIdsInField) {
            const pDocs = partyDocsMap.get(partyId) || [];
            for (const pDoc of pDocs) {
                const docData = pDoc.document;
                if (!docData) continue;
                
                const docId = docData.id;
                if (!dedupMap.has(docId)) {
                    // Get oldest event for lifecycleCreatedAt
                    const oldestEvent = pDoc.events[pDoc.events.length - 1];
                    dedupMap.set(docId, {
                        documentId: docId,
                        displayName: docData.name,
                        mimeType: docData.mimeType || null,
                        sizeBytes: docData.sizeBytes?.toString() || null,
                        lifecycleCreatedAt: oldestEvent.assertedAt.toISOString(),
                        currentDocumentCreatedAt: docData.createdAt.toISOString(),
                        uploadedBy: docData.uploadedBy ? { displayName: docData.uploadedBy.name } : undefined,
                        provenance: []
                    });
                }
                
                const attachment = dedupMap.get(docId)!;
                // Get party name from the included party.data
                const latestEvent = pDoc.events[0];
                const partyName = (latestEvent as any).party?.data ? getPartyName((latestEvent as any).party.data) : "Unknown Party";
                
                if (!attachment.provenance.some(p => p.type === 'PARTY' && p.partyDocumentInstanceId === pDoc.instanceId)) {
                    attachment.provenance.push({
                        type: 'PARTY',
                        partyId,
                        partyName,
                        partyDocumentInstanceId: pDoc.instanceId
                    });
                }
            }
        }

        // Deterministic sort of provenance
        for (const attachment of dedupMap.values()) {
            attachment.provenance.sort((a, b) => {
                if (a.type === 'FIELD' && b.type === 'PARTY') return -1;
                if (a.type === 'PARTY' && b.type === 'FIELD') return 1;
                if (a.type === 'PARTY' && b.type === 'PARTY') {
                    const cmp = a.partyName.localeCompare(b.partyName);
                    if (cmp !== 0) return cmp;
                    return a.partyDocumentInstanceId.localeCompare(b.partyDocumentInstanceId);
                }
                if (a.type === 'FIELD' && b.type === 'FIELD') {
                    return a.fieldAttachmentInstanceId.localeCompare(b.fieldAttachmentInstanceId);
                }
                return 0;
            });
        }

        result.set(fieldNo, Array.from(dedupMap.values()));
    }

    return result;
}

export interface QuestionAttachmentTarget {
    id: string;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
}

export interface QuestionAttachmentsContext {
    clientLEId: string;
    subjectLeId?: string | null;
    resolvedValuesMap?: Map<number, DerivedValue | DerivedValue[] | null>;
    fieldDefsMap?: Map<number, { allowAttachments?: boolean; profileConfig?: { displayMask?: string[] } }>;
}

export interface QuestionAttachmentResult {
    questionId: string;
    attachments: ResolvedAttachment[];
    documentIds: string[];
    attachmentFilenames: string[];
    hasAttachments: boolean;
}

/**
 * Resolves canonical Master Data attachments for a set of questionnaire questions.
 * Handles both single mapped fields (masterFieldNo) and field groups (masterQuestionGroupId),
 * combining and deduplicating by documentId at the question level.
 */
export async function resolveQuestionAttachmentsBatch(
    questions: QuestionAttachmentTarget[],
    context: QuestionAttachmentsContext
): Promise<Map<string, QuestionAttachmentResult>> {
    const resultMap = new Map<string, QuestionAttachmentResult>();
    if (questions.length === 0) return resultMap;

    // 1. Collect all unique field numbers across all questions (including expanding groups)
    const allFieldNos = new Set<number>();
    const groupMap = new Map<string, number[]>(); // groupKey -> fieldNos

    const hasGroups = questions.some(q => q.masterQuestionGroupId);
    if (hasGroups) {
        const { listAllMasterGroupsWithItems } = await import("@/services/masterData/definitionService");
        const allGroups = await listAllMasterGroupsWithItems();
        for (const g of allGroups) {
            groupMap.set(g.key, g.fieldNos);
        }
    }

    for (const q of questions) {
        if (q.masterFieldNo) {
            allFieldNos.add(q.masterFieldNo);
        }
        if (q.masterQuestionGroupId) {
            const groupFields = groupMap.get(q.masterQuestionGroupId) || [];
            for (const fNo of groupFields) {
                allFieldNos.add(fNo);
            }
        }
    }

    if (allFieldNos.size === 0) {
        for (const q of questions) {
            resultMap.set(q.id, {
                questionId: q.id,
                attachments: [],
                documentIds: [],
                attachmentFilenames: [],
                hasAttachments: false
            });
        }
        return resultMap;
    }

    // 2. Ensure field definitions are loaded for party document displayMask rules
    let fieldDefsMap = context.fieldDefsMap;
    if (!fieldDefsMap) {
        fieldDefsMap = new Map();
        const { getMasterFieldDefinition } = await import("@/services/masterData/definitionService");
        await Promise.all(
            Array.from(allFieldNos).map(async (fNo) => {
                const def = await getMasterFieldDefinition(fNo);
                if (def) {
                    fieldDefsMap!.set(fNo, {
                        allowAttachments: def.allowAttachments,
                        profileConfig: (def as any).profileConfig
                    });
                }
            })
        );
    }

    // 3. Resolve amalgamated attachments
    let resolvedValuesMap = context.resolvedValuesMap;
    if (!resolvedValuesMap && (context.subjectLeId || context.clientLEId)) {
        resolvedValuesMap = new Map();
        const { KycStateService } = await import("@/lib/kyc/KycStateService");
        const { getMasterFieldDefinition } = await import("@/services/masterData/definitionService");
        const resolvedScope = context.clientLEId ? await KycStateService.resolveScopeId(context.clientLEId) : undefined;
        const ownerScopeId = resolvedScope || undefined;
        for (const fNo of Array.from(allFieldNos)) {
            const def = await getMasterFieldDefinition(fNo);
            if (def?.isMultiValue) {
                const collection = await KycStateService.getAuthoritativeCollection(
                    { subjectLeId: context.subjectLeId, clientLEId: context.clientLEId },
                    fNo,
                    ownerScopeId
                );
                if (collection && collection.length > 0) {
                    resolvedValuesMap.set(fNo, { value: collection.map((c: any) => c.value) } as any);
                }
            } else {
                const derived = await KycStateService.getAuthoritativeValue(
                    { subjectLeId: context.subjectLeId, clientLEId: context.clientLEId },
                    fNo,
                    ownerScopeId
                );
                if (derived) {
                    resolvedValuesMap.set(fNo, derived);
                }
            }
        }
    } else if (!resolvedValuesMap) {
        resolvedValuesMap = new Map();
    }

    const attachmentsByField = await resolveAmalgamatedAttachments(
        { subjectLeId: context.subjectLeId, clientLEId: context.clientLEId },
        Array.from(allFieldNos),
        resolvedValuesMap,
        fieldDefsMap
    );

    // 4. Map back to each question and deduplicate per question
    for (const q of questions) {
        const questionFieldNos: number[] = [];
        if (q.masterFieldNo) {
            questionFieldNos.push(q.masterFieldNo);
        }
        if (q.masterQuestionGroupId) {
            const groupFields = groupMap.get(q.masterQuestionGroupId) || [];
            for (const fNo of groupFields) {
                if (!questionFieldNos.includes(fNo)) {
                    questionFieldNos.push(fNo);
                }
            }
        }

        const deduped: ResolvedAttachment[] = [];
        const seenDocIds = new Set<string>();

        for (const fNo of questionFieldNos) {
            const atts = attachmentsByField.get(fNo) || [];
            for (const att of atts) {
                if (!seenDocIds.has(att.documentId)) {
                    seenDocIds.add(att.documentId);
                    deduped.push(att);
                }
            }
        }

        resultMap.set(q.id, {
            questionId: q.id,
            attachments: deduped,
            documentIds: Array.from(seenDocIds),
            attachmentFilenames: deduped.map(d => d.displayName),
            hasAttachments: deduped.length > 0
        });
    }

    return resultMap;
}

