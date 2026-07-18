export type DocumentUsageType = 'FIELD_ATTACHMENT' | 'PARTY_DOCUMENT' | 'QUESTION_ATTACHMENT';

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
        questionId?: string;
        questionnaireId?: string;
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
        questionId?: string;
        questionnaireId?: string;
    };
}
