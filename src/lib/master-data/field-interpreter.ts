import { FieldDisplayModel, ResolvedFieldValue, FieldSource, ResolvedAttachment } from './field-display-model';
import { getSourceDisplayName } from '@/lib/source-display';
import { isPartyValue, getPartySummary } from './party-value';
import { isAddressValue, getAddressSummary } from './address-value';
import { formatStructuredCollectionRow } from './structured-value-formatters';

export interface FieldInterpreterMetadata {
    fieldNo: number;
    label: string;
    description?: string;
    category?: string;
    isEditable?: boolean;
    isMultiValue?: boolean;
    defaultText?: string;
    displayState?: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE";
    /** DB appDataType — drives future displayHint derivation. */
    appDataType?: string;
    /** Field-level profile configuration — carries displayMask for PARTY fields. */
    profileConfig?: { displayMask?: string[] };
    /** Controlled-vocabulary code system identifier (e.g. 'SIC_2007_UK'). */
    codeSystem?: string;
    attachments?: import('./field-display-model').ResolvedAttachment[];
    allowAttachments?: boolean;
    clientLEId?: string;
}

export interface RawFieldSource {
    type: string;
    reference?: string | null;
    timestamp?: Date | string | null;
    sourceCheckedAt?: Date | string | null;
    userName?: string | null;
}

export interface CollectionItemEnvelope {
    value: any;
    source: RawFieldSource | null;
    instanceId?: string;
}

export function resolveFieldCollectionForDisplay(
    items: CollectionItemEnvelope[],
    metadata: FieldInterpreterMetadata
): FieldDisplayModel {
    if (!items || items.length === 0) {
        return resolveFieldForDisplay([], null, metadata);
    }

    const state = resolveState(metadata.displayState, items);
    
    // We parse each envelope individually to preserve per-item provenance
    const resolvedItems = items.map((envelope, idx) => {
        let innerVal = envelope.value;
        if (typeof innerVal === 'string' && (innerVal.startsWith('{') || innerVal.startsWith('['))) {
            try { innerVal = JSON.parse(innerVal); } catch (e) {}
        }
        const val = parseAnyValue(innerVal, metadata.profileConfig?.displayMask, metadata.codeSystem, metadata.appDataType, metadata.fieldNo);

        let itemAttachments: ResolvedAttachment[] | undefined;
        let ccPartyId: string | undefined;
        let partyNameStr: string | undefined;

        if (val.kind === 'partyRef') {
            ccPartyId = val.refId;
            partyNameStr = val.partyLabel;
        } else if (val.kind === 'party') {
            ccPartyId = (val.data as any)?.id || (val.data as any)?.ccPartyId || (innerVal as any)?.ccPartyId || (innerVal as any)?.id || (innerVal as any)?.partyId;
            const pd = val.data;
            partyNameStr = val.partyLabel || getPartySummary(pd) || [pd?.forenames, pd?.surname].filter(Boolean).join(' ') || pd?.organisationName || pd?.displayName || undefined;
        }

        if (metadata.attachments && metadata.attachments.length > 0) {
            const matched = metadata.attachments.filter(att =>
                att.provenance?.some(p => {
                    if (p.type !== 'PARTY') return false;
                    if (ccPartyId && p.partyId === ccPartyId) return true;
                    if (partyNameStr && p.partyName && p.partyName.trim().toLowerCase() === partyNameStr.trim().toLowerCase()) return true;
                    return false;
                })
            );
            if (matched.length > 0) {
                itemAttachments = matched;
            }
        }

        return {
            stableKey: envelope.instanceId || `item-${idx}`,
            value: val,
            source: envelope.source ? (resolveSource(envelope.source, 'POPULATED') ?? undefined) : undefined,
            attachments: itemAttachments
        };
    });

    let fieldSource: FieldSource | null = null;
    const sources = resolvedItems.map(i => i.source).filter(Boolean) as FieldSource[];
    if (sources.length > 0) {
        const uniqueIdentities = new Set(sources.map(s => `${s.type}:${s.reference ?? ''}`));
        if (uniqueIdentities.size === 1) {
            fieldSource = sources[0];
        } else {
            // MULTI_SOURCE for mixed/multiple provenances
            fieldSource = { type: 'MULTI_SOURCE', label: 'Multiple sources', colorKey: 'SYSTEM', category: 'SYSTEM' };
        }
    }

    const resolvedValue: ResolvedFieldValue = {
        kind: 'collection',
        items: resolvedItems
    };

    return {
        fieldNo: metadata.fieldNo,
        label: metadata.label,
        description: metadata.description,
        category: metadata.category,
        state,
        value: resolvedValue,
        source: fieldSource,
        textSummary: generateTextSummary(resolvedValue, metadata.defaultText),
        defaultText: metadata.defaultText,
        isEditable: metadata.isEditable ?? false,
        isMultiValue: true,
        attachments: metadata.attachments || [],
        allowAttachments: metadata.allowAttachments ?? false,
        clientLEId: metadata.clientLEId,
    };
}

export function resolveFieldForDisplay(
    rawValue: any,
    rawSource: RawFieldSource | null,
    metadata: FieldInterpreterMetadata
): FieldDisplayModel {
    let parsedValue = rawValue;
    if (typeof rawValue === 'string' && (rawValue.startsWith('{') || rawValue.startsWith('['))) {
        try {
            parsedValue = JSON.parse(rawValue);
        } catch (e) {
            // Leave as string if invalid JSON
        }
    }

    const state = resolveState(metadata.displayState, parsedValue);
    const resolvedValue = resolveValue(parsedValue, state, metadata.defaultText, metadata.profileConfig?.displayMask, metadata.codeSystem, metadata.appDataType, metadata.fieldNo);
    const source = resolveSource(rawSource, state);

    return {
        fieldNo: metadata.fieldNo,
        label: metadata.label,
        description: metadata.description,
        category: metadata.category,
        state,
        value: resolvedValue,
        source,
        textSummary: generateTextSummary(resolvedValue, metadata.defaultText),
        defaultText: metadata.defaultText,
        isEditable: metadata.isEditable ?? false,
        isMultiValue: metadata.isMultiValue ?? false,
        attachments: metadata.attachments || [],
        allowAttachments: metadata.allowAttachments ?? false,
        clientLEId: metadata.clientLEId,
    };
}

function resolveState(
    displayState: FieldInterpreterMetadata['displayState'],
    parsedValue: any
): FieldDisplayModel['state'] {
    if (displayState === 'UNMAPPED_NO_RESPONSE') return 'UNMAPPED';
    if (displayState === 'CHECKED_NO_DATA') return 'NO_DATA';
    if (displayState === 'DEFAULT_RESPONSE') return 'DEFAULT';

    if (parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue) && parsedValue.explicitNone === true) {
        return 'EXPLICIT_NONE';
    }

    const isEmpty = parsedValue === null || parsedValue === undefined || 
                    (typeof parsedValue === 'string' && parsedValue.trim() === '') || 
                    (Array.isArray(parsedValue) && parsedValue.length === 0) ||
                    (typeof parsedValue === 'object' && !Array.isArray(parsedValue) && !(parsedValue instanceof Date) && Object.keys(parsedValue).length === 0);
                    
    if (isEmpty) return 'NO_DATA';

    return 'POPULATED';
}

function resolveValue(
    parsedValue: any,
    state: FieldDisplayModel['state'],
    defaultText?: string,
    displayMask?: string[],
    codeSystem?: string,
    appDataType?: string,
    fieldNo?: number
): ResolvedFieldValue {
    if (state === 'EXPLICIT_NONE' || state === 'NO_DATA' || state === 'UNMAPPED') {
        return { kind: 'empty' };
    }

    if (state === 'DEFAULT') {
        return { 
            kind: 'scalar', 
            display: defaultText || '', 
            rawValue: defaultText || null 
        };
    }

    return parseAnyValue(parsedValue, displayMask, codeSystem, appDataType, fieldNo);
}

import { normaliseCCPartyData as normalisePartyReadModel } from './party-v2/normaliser';
import { getPartyLabel } from './party-v2/label-helper';

function parseAnyValue(val: any, displayMask?: string[], codeSystem?: string, appDataType?: string, fieldNo?: number): ResolvedFieldValue {
    if (val === null || val === undefined) return { kind: 'empty' };

    if (val instanceof Date) {
        if (isNaN(val.getTime())) {
            return { kind: 'scalar', display: 'Invalid Date', rawValue: String(val) };
        }
        const display = val.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        return { kind: 'scalar', display, rawValue: val.toISOString() };
    }

    if (Array.isArray(val)) {
        if (val.length === 0) return { kind: 'empty' };
        
        // Simple heuristic for CodeList
        if (typeof val[0] === 'object' && val[0] !== null && 'code' in val[0]) {
            return {
                kind: 'codeList',
                items: val.map(item => ({
                    code: String(item.code),
                    label: item.label || String(item.code),
                    source: item.sourceType ? (resolveSource({ type: item.sourceType, reference: item.sourceReference }, 'POPULATED') ?? undefined) : undefined
                })),
                codeSystem
            };
        }

        return {
            kind: 'collection',
            items: val.map(item => ({ 
                value: parseAnyValue(item, displayMask, codeSystem, appDataType, fieldNo),
                source: item?.sourceType ? (resolveSource({ type: item.sourceType, reference: item.sourceReference }, 'POPULATED') ?? undefined) : undefined
            }))
        };
    }

    if (typeof val === 'object') {
        if (val.ccPartyId) {
            const resolvedParty = val.ccParty?.data || val._resolvedData?.ccParty?.data;
            const norm = normalisePartyReadModel(resolvedParty || val);
            const partyLabel = norm ? getPartyLabel(norm) : `ID:${val.ccPartyId.slice(0, 8)}…`;
            
            return {
                kind: 'partyRef',
                refId: val.ccPartyId,
                summary: resolvedParty ? getPartySummary(resolvedParty, displayMask) : `ID:${val.ccPartyId.slice(0, 8)}…`,
                partyLabel,
                resolved: resolvedParty,
                displayMask
            };
        }
        if (val.ccAddressId) {
            const resolvedAddress = val.ccAddress?.data || val._resolvedData?.ccAddress?.data;
            return {
                kind: 'addressRef',
                refId: val.ccAddressId,
                summary: resolvedAddress ? getAddressSummary(resolvedAddress) : `ID:${val.ccAddressId.slice(0, 8)}…`,
                resolved: resolvedAddress
            };
        }
        
        // Attempt to format as a known structured collection row first
        // This ensures that explicit structural formats (like Field 5 - Previous Names)
        // are not erroneously caught by the generic Party sniffer simply because they have a "name" property.
        if (appDataType !== 'PARTY' && fieldNo !== undefined) {
            const formatted = formatStructuredCollectionRow(fieldNo, val);
            if (formatted.handled) {
                const displayStr = formatted.secondary 
                    ? `${formatted.primary} (${formatted.secondary})`
                    : formatted.primary || '';
                return {
                    kind: 'scalar',
                    display: displayStr,
                    rawValue: val
                };
            }
        }
        
        // Attempt canonical Party normalisation for embedded values
        let isParty = false;
        if (appDataType === 'PARTY') {
            if (typeof val === 'object' && val !== null) isPartyValue(val); // run for normalisation mutations
            isParty = true;
        } else if (isPartyValue(val) || ('contactType' in val) || ('forenames' in val) || ('firstName' in val)) {
            isParty = true;
        }

        if (isParty) {
            const norm = normalisePartyReadModel(val);
            if (norm) {
                return {
                    kind: 'party',
                    data: val as any,
                    summary: getPartySummary(val as any, displayMask),
                    partyLabel: getPartyLabel(norm),
                    displayMask
                };
            }
        }

        if (isAddressValue(val)) {
            return {
                kind: 'address',
                data: val as any,
                summary: getAddressSummary(val)
            };
        }

        // Unrecognized object
        return {
            kind: 'scalar',
            display: '[Structured value]',
            rawValue: val
        };
    }

    // Primitive
    if (typeof val === 'boolean') {
        return { kind: 'scalar', display: val ? 'Yes' : 'No', rawValue: val };
    }
    if (appDataType === 'DATE' && (typeof val === 'string' || typeof val === 'number')) {
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const display = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                return { kind: 'scalar', display, rawValue: val };
            }
        } catch {}
    }
    
    return { kind: 'scalar', display: String(val), rawValue: val };
}

function resolveSource(rawSource: RawFieldSource | null | undefined, state: FieldDisplayModel['state']): FieldSource | null {
    if (!rawSource || !rawSource.type) {
        if (state === 'DEFAULT') return { type: 'DEFAULT', label: 'System Default', colorKey: 'DEFAULT', category: 'DEFAULT' };
        return null;
    }

    const type = rawSource.type;
    const category = type === 'USER_INPUT' ? 'USER' : 
                     (type === 'GLEIF' || type === 'REGISTRATION_AUTHORITY') ? 'REGISTRY' : 
                     'SYSTEM';

    let colorKey = 'SYSTEM';
    if (type === 'USER_INPUT') colorKey = 'USER';
    else if (type === 'GLEIF') colorKey = 'GLEIF';
    else if (type === 'REGISTRATION_AUTHORITY' || type === 'NATIONAL_REGISTRY') colorKey = 'REGISTRY';
    else if (type === 'AI_EXTRACTION') colorKey = 'AI';

    let timestamp: string | undefined;
    if (rawSource.timestamp) {
        timestamp = rawSource.timestamp instanceof Date ? rawSource.timestamp.toISOString() : String(rawSource.timestamp);
    }

    const checkTime = rawSource.sourceCheckedAt || rawSource.timestamp;
    let lastValidatedAt: string | undefined;
    if (checkTime) {
        lastValidatedAt = checkTime instanceof Date ? checkTime.toISOString() : String(checkTime);
    }

    return {
        type,
        reference: rawSource.reference || null,
        label: getSourceDisplayName(type, rawSource.reference),
        colorKey,
        timestamp,
        userName: rawSource.userName || null,
        category,
        lastValidatedAt
    };
}

function generateTextSummary(resolvedValue: ResolvedFieldValue, defaultText?: string): string {
    switch (resolvedValue.kind) {
        case 'empty':
            return '';
        case 'scalar':
            return resolvedValue.display;
        case 'party':
        case 'address':
        case 'partyRef':
        case 'addressRef':
            return resolvedValue.summary;
        case 'codeList':
            return resolvedValue.items.map(i => i.label).join('; ');
        case 'collection':
            return resolvedValue.items.map(i => generateTextSummary(i.value)).filter(Boolean).join('; ');
        default:
            return '';
    }
}
