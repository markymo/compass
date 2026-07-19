export interface FieldDisplayModel {
    fieldNo: number;
    label: string;
    description?: string;
    category?: string;

    // The canonical value representation
    value: ResolvedFieldValue;
    
    // Core states
    state: 'POPULATED' | 'EXPLICIT_NONE' | 'DEFAULT' | 'UNMAPPED' | 'NO_DATA';
    
    // Provenance
    source: FieldSource | null;
    
    // For scalar/plain-text contexts (Export, Tooltips)
    textSummary: string;
    
    // Optional Fallback Text (e.g. default values)
    defaultText?: string;
    
    // Behavioural Flags
    isEditable: boolean;
    isMultiValue: boolean;
    
    // Attachments
    attachments: ResolvedAttachment[];
    allowAttachments: boolean;
    clientLEId?: string;
}

export interface ResolvedAttachment {
    instanceId: string;
    documentId: string;
    displayName: string;
    mimeType: string | null;
    sizeBytes: string | null;
    lifecycleCreatedAt: string;
    currentDocumentCreatedAt: string;
    uploadedBy?: { displayName: string | null };
}

// Discriminated Union for exhaustive type checking on the UI side
export type ResolvedFieldValue =
    | { kind: 'empty' }
    | { kind: 'scalar'; display: string; rawValue: string | number | boolean | null }
    | { kind: 'party'; data: import('./party-value').PartyValue; summary: string; partyLabel: string; displayMask?: string[] }
    | { kind: 'address'; data: import('./address-value').AddressValue; summary: string }
    | { kind: 'partyRef'; refId: string; summary: string; partyLabel: string; resolved?: import('./party-value').PartyValue; displayMask?: string[] }
    | { kind: 'addressRef'; refId: string; summary: string; resolved?: import('./address-value').AddressValue }
    | { kind: 'codeList'; items: Array<{ code: string; label: string; source?: FieldSource }>; codeSystem?: string }
    | { kind: 'collection'; items: Array<{ value: ResolvedFieldValue; source?: FieldSource }> };

// Canonical Source
export interface FieldSource {
    type: string;           // e.g. 'GLEIF', 'USER_INPUT', 'REGISTRATION_AUTHORITY'
    reference?: string | null; // e.g. 'COMPANIES_HOUSE', 'RA000585'
    label: string;          // Pre-resolved human label
    colorKey: string;       // Maps to SOURCE_PALETTE
    timestamp?: string;     // ISO String for JSON serialisability
    userName?: string | null; // Optional for USER_INPUT
    category: 'REGISTRY' | 'USER' | 'SYSTEM' | 'DEFAULT';
    lastValidatedAt?: string; // ISO String for JSON serialisability
}
