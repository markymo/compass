export function applyMasterDataProjection(value: any, path: string | null | undefined): any {
    if (!path || value === null || value === undefined) return value;
    
    let current = value;

    // Transparently unwrap curated references before projecting
    if (current && typeof current === 'object') {
        if (current._resolvedData?.ccAddress?.data) {
            current = current._resolvedData.ccAddress.data;
        } else if (current._resolvedData?.ccParty?.data) {
            current = current._resolvedData.ccParty.data;
        } else if (current.ccAddress?.data) {
            current = current.ccAddress.data;
        } else if (current.ccParty?.data) {
            current = current.ccParty.data;
        }
    }

    // Convert array indices like a[0] to a.0
    // Then split by dot to traverse the nested structure
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    
    for (const key of keys) {
        if (current === null || current === undefined) {
            return null;
        }
        current = current[key];
    }
    
    return current ?? null;
}
