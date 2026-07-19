/**
 * src/lib/kyc/canonical-comparison.ts
 *
 * Defines explicit semantic equality for Party snapshots and field claims.
 * Replaces generic deep-equality to ensure transport properties and 
 * unordered collections are compared correctly.
 */

export function canonicaliseClaimValueForComparison(value: any): any {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (Array.isArray(value)) {
        // We do not indiscriminately sort arrays.
        // Array ordering is preserved UNLESS we know it's a semantically unordered set.
        return value.map(canonicaliseClaimValueForComparison);
    }

    if (typeof value === 'object') {
        const canonical: Record<string, any> = {};
        
        // Sort keys to ensure object key ordering is ignored
        const keys = Object.keys(value).sort();
        
        for (const key of keys) {
            // Strip transport-only metadata
            if (key === 'rowKey') continue;
            
            // Explicit nulls are preserved. Undefined is treated as absent (dropped from keys)
            if (value[key] === undefined) continue;

            const val = value[key];

            // Specific canonicalization for known Party structures
            if (key === 'sourceIdentifiers' && Array.isArray(val)) {
                // Source identifiers are semantically unordered
                const canonicalArray = val.map(canonicaliseClaimValueForComparison);
                // Sort by stringified value for deterministic unordered comparison
                canonicalArray.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
                canonical[key] = canonicalArray;
                continue;
            }

            canonical[key] = canonicaliseClaimValueForComparison(val);
        }
        return canonical;
    }

    // Convert strings representing dates to timestamps for comparison if needed?
    // Not safely possible here without schema.

    return value;
}

/**
 * Compares two values for semantic equality.
 * @param a Current authoritative value
 * @param b Incoming payload value
 * @param isPartialSnapshot If true, omitted properties in `b` do not erase properties in `a`.
 */
export function valuesAreCanonicallyEqual(a: any, b: any, isPartialSnapshot: boolean = false): boolean {
    const canonicalA = canonicaliseClaimValueForComparison(a);
    const canonicalB = canonicaliseClaimValueForComparison(b);

    return deepEqualWithAbsence(canonicalA, canonicalB, isPartialSnapshot);
}

function deepEqualWithAbsence(a: any, b: any, isPartialSnapshot: boolean): boolean {
    if (a === b) return true;

    if (a === null && b === null) return true;
    
    // Explicit NONE handling
    if (a?.explicitNone === true && b?.explicitNone === true) return true;

    if (typeof a !== typeof b) {
        return false;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqualWithAbsence(a[i], b[i], isPartialSnapshot)) return false;
        }
        return true;
    }

    if (typeof a === 'object' && a !== null && b !== null) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        const allKeys = new Set([...keysA, ...keysB]);
        for (const key of allKeys) {
            const valA = a[key];
            const valB = b[key];
            
            // If valB is missing (undefined) but valA is present:
            if (valB === undefined && valA !== undefined) {
                if (isPartialSnapshot) {
                    // Omission is NOT authoritative, it means "unchanged".
                    continue;
                }
                return false;
            }

            if (!deepEqualWithAbsence(valA, valB, isPartialSnapshot)) {
                return false;
            }
        }
        return true;
    }

    return false;
}
