
export type ProvenanceSource = 'GLEIF' | 'COMPANIES_HOUSE' | 'USER_INPUT' | 'SYSTEM';

export type FieldValue = {
    value: any;
    source: ProvenanceSource;
    evidenceId?: string;
    timestamp?: string;
};

export type ProposalAction = 'NO_CHANGE' | 'PROPOSE_UPDATE' | 'BLOCKED';

export type FieldProposal = {
    fieldNo: number;
    fieldName: string;           // from FieldDefinitions
    table: string;               // from FieldDefinitions (model name)
    column: string | null;       // from FieldDefinitions
    current?: FieldValue;
    proposed?: FieldValue;
    action: ProposalAction;
    reason?: string;             // explain overwrite rule / mismatch / etc
};
