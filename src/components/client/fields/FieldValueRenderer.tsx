import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FieldDisplayModel } from "@/lib/master-data/field-display-model";
import { PartyRenderer } from "./PartyRenderer";
import { AddressRenderer } from "./AddressRenderer";
import { CollectionRenderer } from "./CollectionRenderer";
import { CodeListRenderer } from "./CodeListRenderer";

export interface FieldValueRendererProps {
    field: FieldDisplayModel;
    layout?: "compact" | "row" | "detailed";
    itemLimit?: number;
    className?: string;
}

export function FieldValueRenderer({ field, layout, itemLimit, className }: FieldValueRendererProps) {
    switch (field.state) {
        case 'POPULATED':
            if (field.value.kind === 'scalar') {
                return <span className={className}>{field.value.display}</span>;
            }
            if (field.value.kind === 'party' || field.value.kind === 'partyRef') {
                return <PartyRenderer value={field.value} layout={layout} className={className} />;
            }
            if (field.value.kind === 'address' || field.value.kind === 'addressRef') {
                return <AddressRenderer value={field.value} layout={layout} className={className} />;
            }
            if (field.value.kind === 'collection') {
                const isComplex = field.value.items.some(i => i.value.kind !== 'scalar' && i.value.kind !== 'empty');
                const collectionLayout = isComplex ? "block" : "inline";
                return (
                    <CollectionRenderer 
                        items={field.value.items} 
                        fieldSource={field.source} 
                        collectionLayout={collectionLayout} 
                        itemLimit={itemLimit}
                        className={className} 
                    />
                );
            }
            if (field.value.kind === 'codeList') {
                return <CodeListRenderer value={field.value} itemLimit={itemLimit} className={className} />;
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
