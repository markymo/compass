import React from 'react';
import { CurrentDocumentUsageDTO } from '@/lib/documents/DocumentLibraryDTOs';
import { Layers } from 'lucide-react';

interface DocumentUsageLabelProps {
    usage: CurrentDocumentUsageDTO;
}

export function DocumentUsageLabel({ usage }: DocumentUsageLabelProps) {
    if (usage.type === 'MASTER_FIELD') {
        return (
            <div className="flex items-start gap-2 text-sm text-gray-700">
                <Layers className="h-4 w-4 mt-0.5 text-gray-400" />
                <div>
                    <span className="font-medium text-gray-900">{usage.fieldLabel}</span>
                    <div className="text-gray-500 text-xs">Field {usage.fieldNo}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-2 text-sm text-gray-700">
            <Layers className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
                <span className="font-medium text-gray-900">Used elsewhere</span>
            </div>
        </div>
    );
}
