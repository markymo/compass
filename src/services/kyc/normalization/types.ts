
export type FieldCandidate = {
    fieldNo: number;
    value: any;
    source: 'GLEIF' | 'REGISTRATION_AUTHORITY' | 'USER_INPUT' | 'SYSTEM';
    sourceKey?: string; // Specific source e.g. 'GB_COMPANIES_HOUSE'
    evidenceId: string | null;
    confidence?: number;
    /**
     * When `value` is an array (multi-value fan-out), each entry at index i
     * may provide a stable `rowKey` that will be used as the `instanceId`
     * for the corresponding FieldClaim.
     *
     * If `rowKeys[i]` is absent or the array is shorter than `value`, the
     * fan-out falls back to the ephemeral `auto_{timestamp}_{i}` key with a
     * warning log. This fallback is intentionally visible so unstable
     * identities are easy to detect and fix.
     */
    rowKeys?: string[];
};
