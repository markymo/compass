import { FieldDisplayModel, ResolvedFieldValue, FieldSource } from './field-display-model';
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
}

export interface RawFieldSource {
    type: string;
    reference?: string | null;
    timestamp?: Date | string | null;
    sourceCheckedAt?: Date | string | null;
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
            return {
                kind: 'partyRef',
                refId: val.ccPartyId,
                summary: resolvedParty ? getPartySummary(resolvedParty, displayMask) : `ID:${val.ccPartyId.slice(0, 8)}…`,
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
        if (isPartyValue(val)) {
            return {
                kind: 'party',
                data: val as any,
                summary: getPartySummary(val, displayMask),
                displayMask
            };
        }
        if (isAddressValue(val)) {
            return {
                kind: 'address',
                data: val as any,
                summary: getAddressSummary(val)
            };
        }
        
        // Attempt to format as a known structured collection row
        if (fieldNo !== undefined) {
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
