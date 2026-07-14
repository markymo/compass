import { Paperclip } from "lucide-react";

export function FieldAttachmentIndicator({ count }: { count?: number }) {
    if (!count || count === 0) return null;
    
    return (
        <div 
            className="flex items-center gap-1 text-slate-400" 
            title={`${count} file${count === 1 ? '' : 's'} attached`}
            aria-label={`${count} file${count === 1 ? '' : 's'} attached`}
        >
            <Paperclip className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{count}</span>
        </div>
    );
}
