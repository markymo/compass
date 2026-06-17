import { COUNTRY_CODES } from "./countries";

export interface AddressValue {
    addressLines?: string[];
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    rawCountry?: string | null;
}

export function getCountryName(code: string | null | undefined): string {
    if (!code) return "";
    const cleanCode = code.toUpperCase().trim();
    return COUNTRY_CODES[cleanCode] || code;
}

export function getAddressSummary(addr: any): string {
    if (!addr) return "";

    let resolvedAddr = addr;
    if (addr.ccAddressId && addr._resolvedData?.ccAddress?.data) {
        resolvedAddr = addr._resolvedData.ccAddress.data;
    }

    const lines = resolvedAddr.addressLines || [];
    const parts = [
        ...lines,
        resolvedAddr.locality,
        resolvedAddr.region,
        resolvedAddr.postalCode,
        resolvedAddr.countryName || getCountryName(resolvedAddr.countryCode) || resolvedAddr.rawCountry || resolvedAddr.countryCode,
    ].filter(Boolean);
    return parts.join(", ");
}

export function isAddressValue(value: any): boolean {
    if (!value || typeof value !== "object") return false;
    
    if (value.ccAddressId && value._resolvedData?.ccAddress?.data) return true;

    // An ADDRESS value is canonical if it contains addressLines.
    // However, do not mistake it for ADDRESS_REF which uses line1, line2, etc.
    return "addressLines" in value && !("line1" in value);
}
