"use client";

import React from "react";

const COUNTRY_CODES: Record<string, string> = {
    'AF': 'Afghanistan', 'AL': 'Albania', 'DZ': 'Algeria', 'AD': 'Andorra', 'AO': 'Angola',
    'AG': 'Antigua and Barbuda', 'AR': 'Argentina', 'AM': 'Armenia', 'AU': 'Australia', 'AT': 'Austria',
    'AZ': 'Azerbaijan', 'BS': 'Bahamas', 'BH': 'Bahrain', 'BD': 'Bangladesh', 'BB': 'Barbados',
    'BY': 'Belarus', 'BE': 'Belgium', 'BZ': 'Belize', 'BJ': 'Benin', 'BT': 'Bhutan',
    'BO': 'Bolivia', 'BA': 'Bosnia and Herzegovina', 'BW': 'Botswana', 'BR': 'Brazil', 'BN': 'Brunei',
    'BG': 'Bulgaria', 'BF': 'Burkina Faso', 'BI': 'Burundi', 'KH': 'Cambodia', 'CM': 'Cameroon',
    'CA': 'Canada', 'CF': 'Central African Republic', 'TD': 'Chad', 'CL': 'Chile', 'CN': 'China',
    'CO': 'Colombia', 'HR': 'Croatia', 'CU': 'Cuba', 'CY': 'Cyprus', 'CZ': 'Czech Republic',
    'DK': 'Denmark', 'DJ': 'Djibouti', 'DO': 'Dominican Republic', 'EC': 'Ecuador', 'EG': 'Egypt',
    'SV': 'El Salvador', 'EE': 'Estonia', 'ET': 'Ethiopia', 'FI': 'Finland', 'FR': 'France',
    'GA': 'Gabon', 'GM': 'Gambia', 'GE': 'Georgia', 'DE': 'Germany', 'GH': 'Ghana',
    'GR': 'Greece', 'GT': 'Guatemala', 'GN': 'Guinea', 'GY': 'Guyana', 'HT': 'Haiti',
    'HN': 'Honduras', 'HU': 'Hungary', 'IS': 'Iceland', 'IN': 'India', 'ID': 'Indonesia',
    'IR': 'Iran', 'IQ': 'Iraq', 'IE': 'Ireland', 'IL': 'Israel', 'IT': 'Italy',
    'JM': 'Jamaica', 'JP': 'Japan', 'JO': 'Jordan', 'KZ': 'Kazakhstan', 'KE': 'Kenya',
    'KW': 'Kuwait', 'KG': 'Kyrgyzstan', 'LA': 'Laos', 'LV': 'Latvia', 'LB': 'Lebanon',
    'LR': 'Liberia', 'LY': 'Libya', 'LI': 'Liechtenstein', 'LT': 'Lithuania', 'LU': 'Luxembourg',
    'MG': 'Madagascar', 'MY': 'Malaysia', 'ML': 'Mali', 'MT': 'Malta', 'MX': 'Mexico',
    'MD': 'Moldova', 'MC': 'Monaco', 'MN': 'Mongolia', 'ME': 'Montenegro', 'MA': 'Morocco',
    'MZ': 'Mozambique', 'MM': 'Myanmar', 'NA': 'Namibia', 'NP': 'Nepal', 'NL': 'Netherlands',
    'NZ': 'New Zealand', 'NI': 'Nicaragua', 'NE': 'Niger', 'NG': 'Nigeria', 'NO': 'Norway',
    'OM': 'Oman', 'PK': 'Pakistan', 'PA': 'Panama', 'PY': 'Paraguay', 'PE': 'Peru',
    'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'QA': 'Qatar', 'RO': 'Romania',
    'RU': 'Russia', 'RW': 'Rwanda', 'SA': 'Saudi Arabia', 'SN': 'Senegal', 'RS': 'Serbia',
    'SG': 'Singapore', 'SK': 'Slovakia', 'SI': 'Slovenia', 'ZA': 'South Africa', 'KR': 'South Korea',
    'ES': 'Spain', 'LK': 'Sri Lanka', 'SD': 'Sudan', 'SE': 'Sweden', 'CH': 'Switzerland',
    'SY': 'Syria', 'TW': 'Taiwan', 'TJ': 'Tajikistan', 'TZ': 'Tanzania', 'TH': 'Thailand',
    'TG': 'Togo', 'TT': 'Trinidad and Tobago', 'TN': 'Tunisia', 'TR': 'Turkey', 'TM': 'Turkmenistan',
    'UG': 'Uganda', 'UA': 'Ukraine', 'AE': 'United Arab Emirates', 'GB': 'United Kingdom', 'US': 'United States',
    'UY': 'Uruguay', 'UZ': 'Uzbekistan', 'VE': 'Venezuela', 'VN': 'Vietnam', 'YE': 'Yemen',
    'ZM': 'Zambia', 'ZW': 'Zimbabwe',
    'XK': 'Kosovo', 'HK': 'Hong Kong', 'MO': 'Macau', 'PS': 'Palestine',
};

export interface AddressValue {
    addressLines?: string[];
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
}

interface AddressValueViewerProps {
    value: any;
    layout?: "compact" | "detailed";
}

export function getCountryName(code: string | null | undefined): string {
    if (!code) return "";
    const cleanCode = code.toUpperCase().trim();
    return COUNTRY_CODES[cleanCode] || code;
}

export function getAddressSummary(addr: AddressValue): string {
    if (!addr) return "";
    const lines = addr.addressLines || [];
    const parts = [
        ...lines,
        addr.locality,
        addr.region,
        addr.postalCode,
        getCountryName(addr.countryCode) || addr.countryCode,
    ].filter(Boolean);
    return parts.join(", ");
}

export function isAddressValue(value: any): boolean {
    if (!value || typeof value !== "object") return false;
    // An ADDRESS value is canonical if it contains addressLines.
    // However, do not mistake it for ADDRESS_REF which uses line1, line2, etc.
    return "addressLines" in value && !("line1" in value);
}

export function AddressValueViewer({ value, layout = "compact" }: AddressValueViewerProps) {
    if (!value || typeof value !== "object") {
        return <span className="text-slate-400 italic">Empty</span>;
    }

    const addr = value as AddressValue;

    if (layout === "compact") {
        return <span>{getAddressSummary(addr) || <span className="text-slate-400 italic">Empty</span>}</span>;
    }

    const lines = addr.addressLines || [];
    const countryLabel = getCountryName(addr.countryCode) || addr.countryCode;

    return (
        <div className="grid grid-cols-1 gap-3.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-sm font-sans mt-2 shadow-inner">
            <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Address</span>
                <span className="text-slate-900 font-medium whitespace-pre-line leading-relaxed">
                    {lines.length > 0 ? lines.join("\n") : <span className="text-slate-400 italic">—</span>}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2">
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Locality</span>
                    <span className="text-slate-900 font-medium">{addr.locality || <span className="text-slate-400 italic">—</span>}</span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Region</span>
                    <span className="text-slate-900 font-medium">{addr.region || <span className="text-slate-400 italic">—</span>}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Postcode</span>
                    <span className="text-slate-900 font-medium">{addr.postalCode || <span className="text-slate-400 italic">—</span>}</span>
                </div>
                <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Country</span>
                    <span className="text-slate-900 font-medium">{countryLabel || <span className="text-slate-400 italic">—</span>}</span>
                </div>
            </div>
        </div>
    );
}
