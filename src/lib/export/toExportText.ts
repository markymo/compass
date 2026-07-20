import { FieldDisplayModel, ResolvedFieldValue } from "@/lib/master-data/field-display-model";
import { getAddressSummary, isAddressValue } from "@/lib/master-data/address-value";
import { getPartySummary, getPartyDisplayProjection } from "@/lib/master-data/party-value";

/**
 * Safely converts a canonical FieldDisplayModel into text for export.
 * Specifically honors profileConfig.displayMask for PARTY records, 
 * intentionally deviating from the UI textSummary to prevent data leakage.
 */
export function toExportText(model: FieldDisplayModel): string {
    if (model.state === 'EXPLICIT_NONE') {
        return "None";
    }
    
    if (model.state === 'NO_DATA' || model.state === 'UNMAPPED') {
        return "No response recorded";
    }

    if (model.state === 'DEFAULT') {
        return model.defaultText || "";
    }

    return exportValue(model.value);
}

function exportValue(val: ResolvedFieldValue): string {
    if (val.kind === 'empty') return "";
    
    if (val.kind === 'scalar') return val.display;

    if (val.kind === 'codeList') {
        // Intentionally fix legacy [Structured value] bug
        return val.items.map(i => i.label).join("; ");
    }

    if (val.kind === 'collection') {
        return val.items.map(i => exportValue(i.value)).filter(Boolean).map(v => `• ${v}`).join("\n");
    }

    if (val.kind === 'address' || val.kind === 'addressRef') {
        if (val.kind === 'addressRef' && val.resolved) {
            return getAddressSummary(val.resolved);
        }
        if (val.kind === 'address') {
            return val.summary; 
        }
        return val.summary; // Fallback for unresolved ref
    }

    if (val.kind === 'party' || val.kind === 'partyRef') {
        const data = val.kind === 'party' ? val.data : val.resolved;
        const displayMask = val.displayMask;
        const partyLabel = 'partyLabel' in val ? val.partyLabel : undefined;

        if (data) {
            const proj = getPartyDisplayProjection(data, displayMask, partyLabel);
            
            const lines: string[] = [];
            if (proj.primaryText) lines.push(proj.primaryText);
            if (proj.secondaryParts.length > 0) lines.push(proj.secondaryParts.join(' · '));
            if (proj.addressText) lines.push(proj.addressText);
            
            if (lines.length > 0) {
                return lines.join('\n');
            }
        }

        return partyLabel || val.summary; // Fallback for unresolved ref or empty data
    }

    return "";
}
