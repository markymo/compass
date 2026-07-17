import { DocumentUsage } from './types';

export interface DocumentUsageProvider {
    getActiveUsages(clientLEId: string, documentIds: string[]): Promise<DocumentUsage[]>;
}
