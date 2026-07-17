export type DocumentUsageType = 'FIELD_ATTACHMENT' | 'PARTY_DOCUMENT';

export interface DocumentUsage {
    documentId: string;
    type: DocumentUsageType;
    instanceId: string;
    attachedAt: Date;
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

export interface DocumentUsageHistoryEvent {
    eventId: string;
    documentId: string;
    type: DocumentUsageType;
    instanceId: string;
    action: 'ATTACHED' | 'REPLACED' | 'REMOVED';
    timestamp: Date;
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
