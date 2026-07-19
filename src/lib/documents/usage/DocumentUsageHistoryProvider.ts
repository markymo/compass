import { DocumentUsageHistoryEvent } from './types';

export interface DocumentUsageHistoryProvider {
    getHistoricalEvents(clientLEId: string, documentId: string): Promise<DocumentUsageHistoryEvent[]>;
}
