export function normalizeCode(input: string): string {
    return input.replace(/[\s\W_]+/g, '').toUpperCase();
}

export function formatYYMMDD(date: Date): string {
    const yy = String(date.getUTCFullYear()).slice(-2);
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
}

export interface ReferenceCodeParams {
    functionalCode: string;
    clientLeShortCode?: string | null;
    supplierShortCode?: string | null;
    isSystemQuestionnaire?: boolean;
    date?: Date;
}

export function generateReferenceCodePrefix(params: ReferenceCodeParams): string {
    const { 
        functionalCode, 
        clientLeShortCode, 
        supplierShortCode, 
        isSystemQuestionnaire = false, 
        date = new Date() 
    } = params;
    
    const func = normalizeCode(functionalCode);
    const yymmdd = formatYYMMDD(date);
    const coparity = isSystemQuestionnaire ? "COPARITY_" : "";
    const client = clientLeShortCode ? normalizeCode(clientLeShortCode) : "XXXXX";
    const supplier = supplierShortCode ? normalizeCode(supplierShortCode) : "SSSSS";

    return `${func}_${yymmdd}_${coparity}${client}_${supplier}`;
}

export function generateWorkingCopyTitle(params: Omit<ReferenceCodeParams, 'date'>): string {
    const func = normalizeCode(params.functionalCode);
    const coparity = params.isSystemQuestionnaire ? "COPARITY_" : "";
    const client = params.clientLeShortCode ? normalizeCode(params.clientLeShortCode) : "XXXXX";
    const supplier = params.supplierShortCode ? normalizeCode(params.supplierShortCode) : "SSSSS";

    return `${func}_UNPUBLISHED_${coparity}${client}_${supplier}`;
}

export function computeNextVersion(prefix: string, existingCodes: string[]): number {
    let maxVersion = 0;
    // Escape prefix for regex
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedPrefix}_v(\\d+)$`);
    
    for (const code of existingCodes) {
        const match = code.match(regex);
        if (match) {
            const v = parseInt(match[1], 10);
            if (!isNaN(v) && v > maxVersion) {
                maxVersion = v;
            }
        }
    }
    return maxVersion + 1;
}
