/**
 * src/lib/kyc/id-scoping.ts
 *
 * Implements machine-level source scoping for relationship row identities,
 * ensuring independent source streams do not collide on instanceIds.
 */

export function buildScopedInstanceId({
    sourceSystemKey,
    sourceStreamKey,
    rawRowKey
}: {
    sourceSystemKey: string;
    sourceStreamKey?: string;
    rawRowKey: string;
}): string {
    // Determine the immutable machine-level namespace
    // We use the system key (e.g., 'REGISTRATION_AUTHORITY' or 'GB_COMPANIES_HOUSE' depending on what's available)
    // and the specific stream key if semantically necessary.
    const namespace = sourceStreamKey 
        ? `${sourceSystemKey}::${sourceStreamKey}` 
        : sourceSystemKey;
        
    return `${namespace}::${rawRowKey}`;
}
