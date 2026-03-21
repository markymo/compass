/**
 * pathResolver.ts
 * 
 * Tokenizer and resolver for dot-notation JSON paths.
 * Used by the table-driven normalizer to extract values from source payloads.
 * 
 * Path contract:
 *  - Dot-separated property access: entity.legalName.name
 *  - Integer array index via brackets: entity.legalAddress.addressLines[0]
 *  - No consecutive dots, wildcards, or empty segments
 *  - Missing intermediate nodes return null (never throw)
 */

export type PathSegment = {
    key: string;
    index?: number; // present only if bracket notation used, e.g. addressLines[0]
};

export class PathParseError extends Error {
    constructor(message: string, public position: number) {
        super(message);
        this.name = 'PathParseError';
    }
}

/**
 * Parse a dot-notation path string into validated segments.
 * Throws PathParseError with position info for malformed paths.
 */
export function parsePath(path: string): PathSegment[] {
    if (!path || path.trim().length === 0) {
        throw new PathParseError('Path cannot be empty', 0);
    }

    const segments: PathSegment[] = [];
    const parts = path.split('.');

    let position = 0;
    for (const part of parts) {
        if (part.length === 0) {
            throw new PathParseError(`Empty segment at position ${position}`, position);
        }

        // Check for bracket notation: key[0]
        const bracketMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/);
        const plainMatch = part.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/);

        if (bracketMatch) {
            segments.push({
                key: bracketMatch[1],
                index: parseInt(bracketMatch[2], 10)
            });
        } else if (plainMatch) {
            segments.push({ key: part });
        } else {
            // Check for specific error types
            if (part.includes('[')) {
                const idxContent = part.match(/\[([^\]]*)\]/);
                if (idxContent && !/^\d+$/.test(idxContent[1])) {
                    throw new PathParseError(
                        `Non-integer array index "${idxContent[1]}" at position ${position}`,
                        position
                    );
                }
                if (part.includes('[]')) {
                    throw new PathParseError(
                        `Empty array index at position ${position}`,
                        position
                    );
                }
            }
            throw new PathParseError(
                `Invalid segment "${part}" at position ${position}`,
                position
            );
        }

        position += part.length + 1; // +1 for the dot separator
    }

    return segments;
}

/**
 * Resolve a parsed path against an object, returning the value or null.
 * Never throws — returns null for missing intermediate nodes.
 */
export function resolveDotPath(obj: any, segments: PathSegment[]): any {
    let current = obj;

    for (const segment of segments) {
        if (current == null || typeof current !== 'object') {
            return null;
        }

        current = current[segment.key];

        if (segment.index !== undefined) {
            if (!Array.isArray(current)) {
                return null;
            }
            if (segment.index >= current.length) {
                return null;
            }
            current = current[segment.index];
        }
    }

    return current ?? null;
}

/**
 * Convenience: parse + resolve in one call.
 * Returns null if path is invalid (does not throw).
 */
export function resolvePathString(obj: any, path: string): any {
    try {
        const segments = parsePath(path);
        return resolveDotPath(obj, segments);
    } catch {
        return null;
    }
}

/**
 * Extract all scalar-like dot paths from an object (for autocomplete).
 * Returns paths relative to the given object.
 * Limits depth and result count for safety.
 */
export function discoverPaths(obj: any, maxDepth = 6, maxResults = 200): string[] {
    const paths: string[] = [];

    function walk(current: any, prefix: string, depth: number) {
        if (depth > maxDepth || paths.length >= maxResults) return;
        if (current == null) return;

        if (typeof current !== 'object') {
            paths.push(prefix);
            return;
        }

        if (Array.isArray(current)) {
            if (current.length > 0) {
                // Show [0] path for first element
                walk(current[0], `${prefix}[0]`, depth + 1);
            }
            return;
        }

        for (const key of Object.keys(current)) {
            const childPath = prefix ? `${prefix}.${key}` : key;
            walk(current[key], childPath, depth + 1);
        }
    }

    walk(obj, '', 0);
    return paths;
}
