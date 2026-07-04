import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FieldDisplayModel } from "@/lib/master-data/field-display-model";

export interface FieldValueRendererProps {
    field: FieldDisplayModel;
    className?: string;
}

export function FieldValueRenderer({ field, className }: FieldValueRendererProps) {
    switch (field.state) {
        case 'POPULATED':
            // Only scalar rendering is supported in this phase
            if (field.value.kind === 'scalar') {
                return <span className={className}>{field.value.display}</span>;
            }
            return null;

        case 'EXPLICIT_NONE':
        case 'NO_DATA':
            return <span className={cn("text-slate-800 font-medium", className)}>None</span>;

        case 'UNMAPPED':
            return <span className={cn("text-slate-400 italic", className)}>No response recorded</span>;

        case 'DEFAULT':
            return (
                <span className={cn("flex items-center gap-2 text-blue-600 font-medium", className)}>
                    <span>{field.defaultText}</span>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-blue-500 bg-blue-50 border-blue-200">
                        Field Default
                    </Badge>
                </span>
            );

        default:
            return null;
    }
}
