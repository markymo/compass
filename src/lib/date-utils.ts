/**
 * date-utils.ts
 * Shared date formatting service for canonical timestamps and business dates.
 */

/**
 * Validates whether the given string is a supported IANA timezone.
 */
export function validateTimezone(tz: string | null | undefined): boolean {
    if (!tz || tz.trim() === '') return true; // Blank resets to UTC
    if (tz.toUpperCase() === 'UTC') return true;
    try {
        return Intl.supportedValuesOf('timeZone').includes(tz);
    } catch(e) {
        return false;
    }
}

/**
 * Resolves a reliable system timezone from a user's preferences JSON object.
 */
export function resolveSystemTimezone(preferences: any): string {
    if (!preferences || typeof preferences !== 'object') return 'UTC';
    let tz = preferences.timezone;
    
    if (!tz || typeof tz !== 'string') return 'UTC';
    tz = tz.trim();
    if (tz === '') return 'UTC';
    if (tz.toUpperCase() === 'UTC') return 'UTC';
    
    try {
        if (Intl.supportedValuesOf('timeZone').includes(tz)) {
            return tz;
        }
    } catch(e) {
        // Fallback
    }
    
    return 'UTC';
}

/**
 * System Timestamps: Point in time.
 * Always renders with explicit timezone abbreviation.
 * Example output: "20 Jul 2026, 12:01 BST" or "20 Jul 2026, 11:01 UTC"
 */
export function formatSystemDateTime(
    timestamp: Date | string | number | null | undefined, 
    timezone: string = 'UTC'
): string | null {
    if (!timestamp) return null;
    try {
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return null;
        
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        }).format(d);
    } catch (e) {
        return null;
    }
}

/**
 * Business Dates: Calendar dates.
 * Parses strings like '2020-05-12' or '2020-05-12T00:00:00Z' and formats them
 * without any timezone conversion. 
 * Example output: "12 May 2020"
 */
export function formatBusinessDate(
    dateString: string | null | undefined
): string | null {
    if (!dateString) return null;
    
    try {
        let cleanStr = dateString.trim();
        const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        
        if (match) {
            const [_, y, m, d] = match;
            // Treat the extracted YYYY-MM-DD explicitly as UTC midnight
            const parsed = new Date(`${y}-${m}-${d}T00:00:00Z`);
            if (isNaN(parsed.getTime())) return cleanStr; // Safe failure, return original string
            
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: 'UTC', // formatting a UTC date in UTC prevents shifting
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).format(parsed);
        }
        
        // If it doesn't match standard patterns, we return the string rather than converting 
        // invalid canonical data into a plausible but incorrect date.
        return cleanStr;
    } catch (e) {
        return dateString;
    }
}
