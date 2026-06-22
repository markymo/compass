
import { ProvenanceSource } from "./ProvenanceTypes";
export type { ProvenanceSource };

export type FieldValue = {
    value: any;
    source: ProvenanceSource;
    evidenceId?: string;
    timestamp?: string;
};

export type ProposalAction = 'NO_CHANGE' | 'PROPOSE_UPDATE' | 'BLOCKED' | 'AUTO_APPLIED';

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
