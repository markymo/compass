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
    subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
    fieldNos: number[],
    resolvedValuesMap: Map<number, DerivedValue | DerivedValue[] | null>,
    fieldDefsMap?: Map<number, { allowAttachments?: boolean; profileConfig?: { displayMask?: string[] } }>
): Promise<Map<number, ResolvedAttachment[]>> {
    const result = new Map<number, ResolvedAttachment[]>();
    if (fieldNos.length === 0) return result;

    // 1. Resolve direct field attachments (only for fields where allowAttachments === true)
    const directFieldNos = fieldDefsMap
        ? fieldNos.filter(fNo => fieldDefsMap.get(fNo)?.allowAttachments !== false)
        : fieldNos;

    const fieldAttachmentsMap = directFieldNos.length > 0
        ? await KycStateService.resolveAllAttachments(subject, directFieldNos)
        : new Map<number, any[]>();

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
