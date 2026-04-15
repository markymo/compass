
export type FieldCandidate = {
    fieldNo: number;
    value: any;
    source: 'GLEIF' | 'REGISTRATION_AUTHORITY' | 'USER_INPUT' | 'SYSTEM';
    sourceKey?: string; // Specific source e.g. 'GB_COMPANIES_HOUSE'
    evidenceId: string | null;
    confidence?: number;
};
