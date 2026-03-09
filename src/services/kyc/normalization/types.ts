
export type FieldCandidate = {
    fieldNo: number;
    value: any;
    source: 'GLEIF' | 'COMPANIES_HOUSE' | 'NATIONAL_REGISTRY' | 'USER_INPUT' | 'SYSTEM';
    sourceKey?: string; // Specific source e.g. 'GB_COMPANIES_HOUSE'
    evidenceId: string | null;
    confidence?: number;
};
