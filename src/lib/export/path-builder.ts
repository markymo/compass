/**
 * Utility for deterministic path generation and sanitization for the Output Pack ZIP.
 * Strictly forbids timestamps or randomness in internal paths.
 */

// Basic sanitization: strip illegal characters and spaces
export function sanitizeFilename(name: string): string {
    if (!name) return "unnamed";
    return name
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/_$/, "") // trim trailing underscore
        .replace(/^_/, "") // trim leading underscore
        .trim() || "unnamed";
}

/**
 * Ensures unique names among siblings by appending _1, _2 deterministically.
 */
export function resolveDuplicate(filename: string, existingNames: Set<string>): string {
    if (!existingNames.has(filename)) {
        existingNames.add(filename);
        return filename;
    }

    const extMatch = filename.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const base = extMatch ? filename.slice(0, -ext.length) : filename;

    let counter = 1;
    let newName = `${base}_${counter}${ext}`;
    while (existingNames.has(newName)) {
        counter++;
        newName = `${base}_${counter}${ext}`;
    }
    
    existingNames.add(newName);
    return newName;
}

export function buildOutputPackFilename(engagementName: string, date: Date = new Date()): string {
    const sanitizedName = sanitizeFilename(engagementName);
    const dateStr = date.toISOString().split('T')[0];
    return `${sanitizedName}_Output_Pack_${dateStr}.zip`;
}

export function buildQuestionnairePdfPath(questionnaireName: string): string {
    const sanitized = sanitizeFilename(questionnaireName);
    return `Questionnaires/${sanitized}.pdf`;
}

export function buildEvidencePath(questionnaireName: string, questionRef: string, originalFilename: string): string {
    const sQName = sanitizeFilename(questionnaireName);
    const sQRef = sanitizeFilename(questionRef);
    const sFilename = sanitizeFilename(originalFilename);
    
    return `Evidence/${sQName}/${sQRef}_${sFilename}`;
}

export function buildGeneralEvidencePath(originalFilename: string): string {
    const sFilename = sanitizeFilename(originalFilename);
    return `Evidence/General/${sFilename}`;
}
