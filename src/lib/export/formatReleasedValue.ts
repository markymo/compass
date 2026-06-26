import { getPartySummary, isPartyValue } from "@/lib/master-data/party-value";
import { getAddressSummary, isAddressValue } from "@/lib/master-data/address-value";
import { enrichPartyReferences, enrichAddressReferences } from "@/actions/kyc-query";

export interface FormatReleasedValueOptions {
    value: any;
    appDataType?: string;
    profileConfig?: any;
}

/**
 * Single safe formatting boundary for all Supplier/FI facing views.
 * Translates rich embedded objects or references into safe display strings,
 * respecting profileConfig.displayMask for PARTY records.
 */
export async function formatReleasedValue({
    value,
    appDataType,
    profileConfig
}: FormatReleasedValueOptions): Promise<string> {
    if (value === null || value === undefined || value === "") return "";

    // Handle Arrays
    if (Array.isArray(value)) {
        const formattedItems = await Promise.all(value.map(v => formatReleasedValue({ value: v, appDataType, profileConfig })));
        return formattedItems.filter(Boolean).join("; ");
    }

    if (typeof value === "object") {
        const clonedValue = JSON.parse(JSON.stringify(value)); // Deep clone to allow safe mutation
        
        if (clonedValue.explicitNone === true) {
            return "None";
        }

        // --- 1. Reference Resolution ---
        // Prioritize pre-enriched data in _resolvedData to avoid N+1 queries during bulk formatting
        const ccParty = clonedValue.ccParty || value._resolvedData?.ccParty;
        if (clonedValue.ccPartyId && !ccParty) {
            const arr = [clonedValue];
            await enrichPartyReferences(arr);
        } else if (ccParty) {
            clonedValue.ccParty = ccParty;
        }

        const ccAddress = clonedValue.ccAddress || value._resolvedData?.ccAddress;
        if (clonedValue.ccAddressId && !ccAddress) {
            const arr = [clonedValue];
            await enrichAddressReferences(arr);
        } else if (ccAddress) {
            clonedValue.ccAddress = ccAddress;
        }

        // --- 2. PARTY Formatting ---
        if (appDataType === 'PARTY' || clonedValue.ccPartyId || isPartyValue(clonedValue)) {
            const partyData = clonedValue.ccParty?.data || clonedValue;
            
            // Check Profile Mask (fallback to visibleFields if renamed later)
            const displayMask = profileConfig?.displayMask || profileConfig?.visibleFields;
            if (Array.isArray(displayMask) && displayMask.length > 0) {
                const resolvePath = (obj: any, path: string) => {
                    const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.');
                    let current = obj;
                    for (const part of parts) {
                        if (current === null || current === undefined) return undefined;
                        current = current[part];
                    }
                    return current;
                };

                const visibleParts = displayMask.map(field => {
                    const val = resolvePath(partyData, field);
                    if (val === null || val === undefined || val === "") return null;
                    if (typeof val === 'object') {
                        if (isAddressValue(val)) {
                            return getAddressSummary(val);
                        }
                        return "[Structured value]";
                    }
                    return String(val);
                }).filter(Boolean);
                
                if (visibleParts.length > 0) {
                    return visibleParts.join(", ");
                }
            }

            // Fallback safe summary
            return getPartySummary(partyData);
        }

        // --- 3. ADDRESS Formatting ---
        if (appDataType === 'ADDRESS' || clonedValue.ccAddressId || isAddressValue(clonedValue)) {
            const addressData = clonedValue.ccAddress?.data || clonedValue;
            return getAddressSummary(addressData);
        }

        // --- 4. Unknown Objects ---
        // Do not dump raw JSON. Use a safe placeholder.
        return "[Structured value]";
    }

    // Scalar values
    return String(value);
}
