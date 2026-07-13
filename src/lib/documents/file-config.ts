export const MAX_PRIVATE_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Defines the allowed document types by combining expected extensions
// with the permitted MIME types (or acknowledging that MIME may be empty for some browser/OS combos).
export const ALLOWED_PRIVATE_DOCUMENT_TYPES = {
    pdf: {
        extensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
        label: 'PDF Document',
    },
    word: {
        extensions: ['.doc', '.docx'],
        mimeTypes: [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        label: 'Word Document',
    },
    excel: {
        extensions: ['.xls', '.xlsx'],
        mimeTypes: [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        label: 'Excel Spreadsheet',
    },
    powerpoint: {
        extensions: ['.ppt', '.pptx'],
        mimeTypes: [
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ],
        label: 'PowerPoint Presentation',
    },
    csv: {
        extensions: ['.csv'],
        mimeTypes: ['text/csv', 'application/csv', ''], // Browsers often fail to map CSV MIME
        label: 'CSV File',
    },
    text: {
        extensions: ['.txt'],
        mimeTypes: ['text/plain'],
        label: 'Text File',
    },
    image: {
        extensions: ['.jpg', '.jpeg', '.png'],
        mimeTypes: ['image/jpeg', 'image/png'],
        label: 'Image',
    }
};

/**
 * Returns all permitted extensions as a flat array for client-side <input accept="...">.
 */
export function getAllowedExtensions(): string[] {
    return Object.values(ALLOWED_PRIVATE_DOCUMENT_TYPES)
        .flatMap(type => type.extensions);
}

/**
 * Validates a file on the client side (for immediate UI feedback).
 * Note: The server blob token remains the authoritative enforcement.
 */
export function isValidPrivateDocument(file: File): { valid: boolean; reason?: string } {
    if (file.size > MAX_PRIVATE_DOCUMENT_SIZE_BYTES) {
        return { valid: false, reason: `File exceeds the maximum allowed size of 20MB.` };
    }

    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    // Check if the extension is recognized
    const matchedType = Object.values(ALLOWED_PRIVATE_DOCUMENT_TYPES).find(t => 
        t.extensions.includes(extension)
    );

    if (!matchedType) {
        return { valid: false, reason: `File type ${extension} is not supported.` };
    }

    // Check MIME type if the browser provided one (or if the policy allows an empty MIME for this type)
    if (file.type && !matchedType.mimeTypes.includes(file.type)) {
        // Fallback for CSVs which are notoriously misidentified
        if (matchedType.mimeTypes.includes('') || file.type.startsWith('text/') || file.type === 'application/vnd.ms-excel') {
            // Allow if it's broadly text-like and extension is good
        } else {
             return { valid: false, reason: `The content type (${file.type}) does not match the expected file extension.` };
        }
    }

    return { valid: true };
}
