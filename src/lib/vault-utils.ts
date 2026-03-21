export interface UploaderInfo {
    name?: string | null;
    email?: string | null;
}

/**
 * Format uploader information for display.
 * Prioritizes Name, then Email, then falls back to "Unknown".
 */
export function formatUploader(user?: UploaderInfo | null): string {
    if (!user) return "Unknown";
    return user.name || user.email || "Unknown";
}
