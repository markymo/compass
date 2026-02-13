
export type FieldCandidate = {
    fieldNo: number;
    value: any;
    source: 'GLEIF' | 'COMPANIES_HOUSE' | 'USER_INPUT' | 'SYSTEM';
    evidenceId: string | null;
    confidence?: number;
};
