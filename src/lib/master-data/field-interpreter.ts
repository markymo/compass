import { FieldDisplayModel, ResolvedFieldValue, FieldSource } from './field-display-model';
import { getSourceDisplayName } from '@/lib/source-display';
import { isPartyValue, getPartySummary } from './party-value';
import { isAddressValue, getAddressSummary } from './address-value';

export interface FieldInterpreterMetadata {
    fieldNo: number;
    label: string;
    description?: string;
    category?: string;
    isEditable?: boolean;
    isMultiValue?: boolean;
    defaultText?: string;
    displayState?: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE";
}

export interface RawFieldSource {
    type: string;
    reference?: string | null;
    timestamp?: Date | string | null;
    userName?: string | null;
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
    const resolvedValue = resolveValue(parsedValue, state, metadata.defaultText);
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
                    (Array.isArray(parsedValue) && parsedValue.length === 0);
                    
    if (isEmpty) return 'NO_DATA';

    return 'POPULATED';
}

function resolveValue(
    parsedValue: any,
    state: FieldDisplayModel['state'],
    defaultText?: string
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

    return parseAnyValue(parsedValue);
}

function parseAnyValue(val: any): ResolvedFieldValue {
    if (val === null || val === undefined) return { kind: 'empty' };

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
                }))
            };
        }

        return {
            kind: 'collection',
            items: val.map(item => ({ value: parseAnyValue(item) }))
        };
    }

    if (typeof val === 'object') {
        if (val.ccPartyId) {
            return {
                kind: 'partyRef',
                refId: val.ccPartyId,
                summary: val.ccParty?.data ? getPartySummary(val.ccParty.data) : `ID:${val.ccPartyId.slice(0, 8)}…`,
                resolved: val.ccParty?.data
            };
        }
        if (val.ccAddressId) {
            return {
                kind: 'addressRef',
                refId: val.ccAddressId,
                summary: val.ccAddress?.data ? getAddressSummary(val.ccAddress.data) : `ID:${val.ccAddressId.slice(0, 8)}…`,
                resolved: val.ccAddress?.data
            };
        }
        if (isPartyValue(val)) {
            return {
                kind: 'party',
                data: val as any,
                summary: getPartySummary(val)
            };
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

    return {
        type,
        reference: rawSource.reference || null,
        label: getSourceDisplayName(type, rawSource.reference),
        colorKey,
        timestamp,
        userName: rawSource.userName || null,
        category
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
