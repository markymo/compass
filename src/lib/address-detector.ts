export interface AddressDetectionResult {
    isLikelyAddress: boolean;
    score: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    detectedFields: {
        addressLines?: string[];
        locality?: string;
        region?: string;
        postalCode?: string;
        countryCode?: string;
        premiseIdentifier?: string;
        subPremise?: string;
    };
    reasons: string[];
    method: "HEURISTIC" | "AI" | "HYBRID";
}

export function isAddressLikePath(path: string): boolean {
    const lastPart = path.split('.').pop() || '';
    // Match any segment containing address, adresse, siege, office, location
    return /address|adresse|siege|office|location/i.test(lastPart);
}

export function detectAddressCandidate(nodePath: string, nodeValue: any): AddressDetectionResult {
    // Return early if not a non-null JSON object
    if (!nodeValue || typeof nodeValue !== 'object' || Array.isArray(nodeValue)) {
        return {
            isLikelyAddress: false,
            score: 0,
            confidence: "LOW",
            detectedFields: {},
            reasons: ["Node value is not a JSON object"],
            method: "HEURISTIC"
        };
    }

    let score = 0;
    const reasons: string[] = [];
    const detectedFields: AddressDetectionResult["detectedFields"] = {};

    const keys = Object.keys(nodeValue);

    // 1. postal_code / postcode / zip / postalCode => +5
    const postalCodeKeys = keys.filter(k => /^(postal_?code|postcode|zip|postalCode|code_?postal)$/i.test(k));
    if (postalCodeKeys.length > 0) {
        score += 5;
        detectedFields.postalCode = String(nodeValue[postalCodeKeys[0]]);
        reasons.push(`Found postal code field: '${postalCodeKeys[0]}'`);
    }

    // 2. country / countryCode => +5
    const countryCodeKeys = keys.filter(k => /^(country|country_?code)$/i.test(k));
    if (countryCodeKeys.length > 0) {
        score += 5;
        detectedFields.countryCode = String(nodeValue[countryCodeKeys[0]]);
        reasons.push(`Found country code field: '${countryCodeKeys[0]}'`);
    }

    // 3. city / locality / town / commune / libelle_commune => +4
    const localityKeys = keys.filter(k => /^(city|locality|town|commune|libelle_?commune)$/i.test(k));
    if (localityKeys.length > 0) {
        score += 4;
        detectedFields.locality = String(nodeValue[localityKeys[0]]);
        reasons.push(`Found locality field: '${localityKeys[0]}'`);
    }

    // 4. address_line / addressLines / adresse / street / thoroughfare => +4
    const addressLinesKeys = keys.filter(k => /address_?line|addressLines|adresse|street|thoroughfare/i.test(k));
    if (addressLinesKeys.length > 0) {
        score += 4;
        const collected: string[] = [];
        addressLinesKeys.forEach(k => {
            const val = nodeValue[k];
            if (Array.isArray(val)) {
                collected.push(...val.map(v => String(v)));
            } else if (val !== null && val !== undefined) {
                collected.push(String(val));
            }
        });
        detectedFields.addressLines = collected;
        reasons.push(`Found address line field(s): ${addressLinesKeys.join(', ')}`);
    }

    // 5. region / state / province / county / department / departement => +3
    const regionKeys = keys.filter(k => /^(region|state|province|county|department|departement)$/i.test(k));
    if (regionKeys.length > 0) {
        score += 3;
        detectedFields.region = String(nodeValue[regionKeys[0]]);
        reasons.push(`Found region field: '${regionKeys[0]}'`);
    }

    // 6. premise / building / house_number / number => +2
    const premiseKeys = keys.filter(k => /^(premise|building|house_?number|number)$/i.test(k));
    if (premiseKeys.length > 0) {
        score += 2;
        detectedFields.premiseIdentifier = String(nodeValue[premiseKeys[0]]);
        reasons.push(`Found premise field: '${premiseKeys[0]}'`);
    }

    // 7. sub_premise / flat / apartment / suite / unit => +2
    const subPremiseKeys = keys.filter(k => /^(sub_?premise|flat|apartment|suite|unit)$/i.test(k));
    if (subPremiseKeys.length > 0) {
        score += 2;
        detectedFields.subPremise = String(nodeValue[subPremiseKeys[0]]);
        reasons.push(`Found sub-premise field: '${subPremiseKeys[0]}'`);
    }

    // Penalty check: if an object contains country or region but has no addressLines, locality, or postalCode,
    // it's highly likely to be a metadata/jurisdiction block rather than a concrete physical address.
    if (!detectedFields.postalCode && !detectedFields.locality && (!detectedFields.addressLines || detectedFields.addressLines.length === 0)) {
        score = Math.max(0, score - 3);
        reasons.push("Penalized score: object lacks street lines, city, or postal code");
    }

    // Heuristics decision
    const isLikelyAddress = score >= 8;
    let confidence: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (score >= 12) {
        confidence = "HIGH";
    } else if (score >= 6) {
        confidence = "MEDIUM";
    }

    return {
        isLikelyAddress,
        score,
        confidence,
        detectedFields,
        reasons,
        method: "HEURISTIC"
    };
}

export function buildRelativeTransformConfig(nodeValue: any, detectedFields: any): any {
    if (!nodeValue || typeof nodeValue !== 'object') {
        return {
            addressLines: [],
            locality: null,
            region: null,
            postalCode: null,
            countryCode: null
        };
    }

    const config: any = {
        addressLines: [],
        locality: null,
        region: null,
        postalCode: null,
        countryCode: null
    };

    const keys = Object.keys(nodeValue);

    // Helper to find a relative path in nodeValue that matches a value
    const findPathForValue = (val: any): string | null => {
        if (val == null || val === '') return null;
        const strVal = String(val).toLowerCase().trim();
        for (const k of keys) {
            const v = nodeValue[k];
            if (v != null && typeof v !== 'object') {
                if (String(v).toLowerCase().trim() === strVal) {
                    return k;
                }
            }
        }
        return null;
    };

    // 1. addressLines
    if (detectedFields.addressLines && Array.isArray(detectedFields.addressLines)) {
        // First check if there is an array key in nodeValue directly (like the GLEIF example: "addressLines": ["Line 1", "Line 2"])
        const arrayKey = keys.find(k => Array.isArray(nodeValue[k]));
        if (arrayKey) {
            config.addressLines.push(arrayKey);
        } else {
            // Find individual line keys
            for (const line of detectedFields.addressLines) {
                const path = findPathForValue(line);
                if (path && !config.addressLines.includes(path)) {
                    config.addressLines.push(path);
                }
            }
        }
    } else {
        // Fallback: look for keys containing address_line, street, thoroughfare, premises
        const streetKeys = keys.filter(k => /address_?line|street|premises|voie/i.test(k));
        streetKeys.forEach(k => {
            if (!config.addressLines.includes(k)) {
                config.addressLines.push(k);
            }
        });
    }

    // 2. locality
    if (detectedFields.locality) {
        config.locality = findPathForValue(detectedFields.locality);
    }
    if (!config.locality) {
        // Fallback: look for city/locality/town/commune
        config.locality = keys.find(k => /^(city|locality|town|commune|ville)$/i.test(k)) || null;
    }

    // 3. region
    if (detectedFields.region) {
        config.region = findPathForValue(detectedFields.region);
    }
    if (!config.region) {
        // Fallback: look for region/state/province/county
        config.region = keys.find(k => /^(region|state|province|county|departement)$/i.test(k)) || null;
    }

    // 4. postalCode
    if (detectedFields.postalCode) {
        config.postalCode = findPathForValue(detectedFields.postalCode);
    }
    if (!config.postalCode) {
        // Fallback: look for postal_code/postcode/zip/postalCode/code_postal
        config.postalCode = keys.find(k => /^(postal_?code|postcode|zip|postalCode|code_?postal)$/i.test(k)) || null;
    }

    // 5. countryCode
    if (detectedFields.countryCode) {
        config.countryCode = findPathForValue(detectedFields.countryCode);
    }
    if (!config.countryCode) {
        // Fallback: look for country/country_code/pays
        config.countryCode = keys.find(k => /^(country|country_?code|pays)$/i.test(k)) || null;
    }

    return config;
}
