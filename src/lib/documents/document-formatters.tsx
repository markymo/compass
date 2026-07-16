import React from 'react';
import { FileText, Image, Sheet, File } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function formatFileSize(sizeBytes: string | undefined): string {
    if (!sizeBytes) return '0 B';
    const bytes = Number(sizeBytes);
    if (isNaN(bytes)) return '0 B';
    
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatFileType(mimeType: string, filename: string): string {
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.startsWith('image/')) {
        const ext = filename.split('.').pop()?.toUpperCase() || 'IMAGE';
        return `${ext} image`;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Excel spreadsheet';
    if (mimeType.includes('wordprocessing') || mimeType.includes('word')) return 'Word document';
    if (mimeType === 'text/csv') return 'CSV spreadsheet';
    if (mimeType.startsWith('text/')) return 'Text file';
    return 'File';
}

export function formatDocumentDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

export function getDocumentIcon(mimeType: string): React.ReactNode {
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-muted-foreground" />;
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-muted-foreground" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return <Sheet className="h-4 w-4 text-muted-foreground" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
}

export function formatDocumentStatus(status: 'IN_USE' | 'PREVIOUSLY_USED' | 'UNUSED'): React.ReactNode {
    switch (status) {
        case 'IN_USE':
            return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">In use</Badge>;
        case 'PREVIOUSLY_USED':
            return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-100">Previously used</Badge>;
        case 'UNUSED':
            return <Badge variant="outline" className="text-gray-500">Unused</Badge>;
        default:
            return <Badge variant="outline">Unknown</Badge>;
    }
}
