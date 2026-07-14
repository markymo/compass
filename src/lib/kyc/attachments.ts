import { DerivedValue } from "@/lib/kyc/KycStateService";
import { ResolvedAttachment } from "@/lib/master-data/field-display-model";

export function mapDerivedAttachments(derivedAttachments: DerivedValue[]): ResolvedAttachment[] {
    return derivedAttachments
        .filter((att): att is DerivedValue & { instanceId: string; attachmentDocumentId: string } => 
            att.instanceId !== undefined && att.attachmentDocumentId !== undefined)
        .map(att => ({
            instanceId: att.instanceId,
            documentId: att.attachmentDocumentId,
            displayName: att.documentName || 'Unknown Document',
            mimeType: att.documentMimeType || null,
            sizeBytes: att.documentSizeBytes || null,
            lifecycleCreatedAt: att.assertedAt.toISOString(),
            currentDocumentCreatedAt: att.documentCreatedAt?.toISOString() || att.assertedAt.toISOString(),
            uploadedBy: att.documentUploadedBy ? { displayName: att.documentUploadedBy } : undefined
        }));
}
