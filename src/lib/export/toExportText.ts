import { FieldDisplayModel, ResolvedFieldValue } from "@/lib/master-data/field-display-model";
import { getAddressSummary, isAddressValue } from "@/lib/master-data/address-value";
import { getPartySummary } from "@/lib/master-data/party-value";

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
        return val.items.map(i => exportValue(i.value)).filter(Boolean).join("; ");
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

        if (data) {
            if (Array.isArray(displayMask) && displayMask.length > 0) {
                // Apply strict display mask to prevent data leakage
                const resolvePath = (obj: any, path: string) => {
                    const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.');
                    let current = obj;
                    for (const part of parts) {
                        if (current === null || current === undefined) return undefined;
                        current = current[part];
                    }
                    return current;
                };

                const visibleParts = displayMask.map(field => {
                    const v = resolvePath(data, field);
                    if (v === null || v === undefined || v === "") return null;
                    if (typeof v === 'object') {
                        if (isAddressValue(v)) {
                            return getAddressSummary(v);
                        }
                        // Intentionally preserve safe placeholder for unknown nested objects
                        return "[Structured value]";
                    }
                    return String(v);
                }).filter(Boolean);

                if (visibleParts.length > 0) {
                    return visibleParts.join(", ");
                }
            }

            // Fallback to summary, but apply the intentional bugfix for Organisation names
            let summary = val.kind === 'party' ? val.summary : getPartySummary(data);
            if (summary === 'Unnamed Individual' || summary === 'Unnamed Organisation') {
                const rawData = data as any;
                const name = data.organisationName || rawData.companyName || rawData.name || data.displayName;
                if (name) {
                    const rolesList = data.roles || [];
                    const activeRole = rolesList.find((r: any) => r.isActiveRole !== false);
                    const roleLabel = activeRole?.roleTitle ?? (rolesList.length > 0 ? rolesList[0].roleTitle : null);
                    summary = roleLabel ? `${name} (${roleLabel})` : name;
                }
            }
            return summary;
        }

        return val.summary; // Fallback for unresolved ref
    }

    return "";
}
