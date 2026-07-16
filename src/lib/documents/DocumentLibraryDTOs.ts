export type DocumentUsageType = 'MASTER_FIELD';

export interface DocumentUploaderDTO {
    id: string;
    displayName: string | null;
}

export interface CurrentDocumentUsageDTO {
    type: DocumentUsageType;
    instanceId: string;
    fieldNo: number;
    fieldLabel: string;
    attachedAt: string;
}

export interface DocumentUsageEventDTO {
    eventId: string;
    type: DocumentUsageType;
    instanceId: string;
    fieldNo: number;
    fieldLabel: string;
    action: 'ATTACHED' | 'REPLACED' | 'REMOVED';
    timestamp: string;
    replacementDocumentId?: string;
    replacementFilename?: string;
}

export interface DocumentLibraryItemDTO {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: string;
    createdAt: string;
    uploadedBy: DocumentUploaderDTO | null;
    currentUsageCount: number;
    historicalUsageCount: number;
    status: 'IN_USE' | 'PREVIOUSLY_USED' | 'UNUSED';
}

export interface DocumentDetailDTO extends DocumentLibraryItemDTO {
    currentUsages: CurrentDocumentUsageDTO[];
    usageHistory: DocumentUsageEventDTO[];
}
