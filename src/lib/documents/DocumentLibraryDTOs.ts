export type DocumentUsageType = 'FIELD_ATTACHMENT' | 'PARTY_DOCUMENT' | 'QUESTION_ATTACHMENT';

export interface DocumentUploaderDTO {
    id: string;
    displayName: string | null;
}

export interface CurrentDocumentUsageDTO {
    type: DocumentUsageType;
    instanceId: string;
    attachedAt: string;
    isActive: boolean;
    display: {
        title: string;
        subtitle?: string;
    };
    metadata: {
        fieldNo?: number;
        partyId?: string;
    };
}

export interface DocumentUsageEventDTO {
    eventId: string;
    type: DocumentUsageType;
    instanceId: string;
    action: 'ATTACHED' | 'REPLACED' | 'REMOVED';
    timestamp: string;
    replacementDocumentId?: string;
    replacementFilename?: string;
    display: {
        title: string;
        subtitle?: string;
    };
    metadata: {
        fieldNo?: number;
        partyId?: string;
    };
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
