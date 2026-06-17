export function applyMasterDataProjection(value: any, path: string | null | undefined): any {
    if (!path || value === null || value === undefined) return value;
    
    // Convert array indices like a[0] to a.0
    // Then split by dot to traverse the nested structure
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    
    let current = value;
    for (const key of keys) {
        if (current === null || current === undefined) {
            return null;
        }
        current = current[key];
    }
    
    return current ?? null;
}
