export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const ALLOWED_MIME_TYPES = [
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'application/csv',
    'text/plain'
];

export function validateDocumentFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
        return `File exceeds the 20MB limit.`;
    }
    // allow empty type to pass to server just in case
    if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') { 
        return `File type ${file.type || 'unknown'} is not supported.`;
    }
    return null;
}
