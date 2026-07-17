import React from 'react';
import { CurrentDocumentUsageDTO } from '@/lib/documents/DocumentLibraryDTOs';
import { Layers, CheckCircle2 } from 'lucide-react';

interface DocumentUsageLabelProps {
    usage: CurrentDocumentUsageDTO;
}

export function DocumentUsageLabel({ usage }: DocumentUsageLabelProps) {
    return (
        <div className="flex items-start gap-2 text-sm text-gray-700">
            <Layers className="h-4 w-4 mt-0.5 text-gray-400" />
            <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-900">{usage.display.title}</span>
                    {usage.isActive && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-label="Active usage" />
                    )}
                </div>
                {usage.display.subtitle && (
                    <div className="text-gray-500 text-xs mt-0.5">{usage.display.subtitle}</div>
                )}
            </div>
        </div>
    );
}
