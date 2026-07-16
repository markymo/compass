import React from "react";
import { CanonicalPartyFormState } from "./state-mappers";
import { Badge } from "@/components/ui/badge";

interface PartySourceIdentifiersSectionProps {
    identifiers: CanonicalPartyFormState['sourceIdentifiers'];
}

export function PartySourceIdentifiersSection({ identifiers }: PartySourceIdentifiersSectionProps) {
    if (!identifiers || identifiers.length === 0) return null;

    return (
        <div className="space-y-2 p-4 bg-gray-50 border rounded-md">
            <h3 className="text-sm font-semibold text-gray-700">Source Identifiers</h3>
            <p className="text-xs text-gray-500 mb-2">These identifiers are preserved from the original data source and cannot be edited.</p>
            <div className="flex flex-col gap-2">
                {identifiers.map((id, index) => (
                    <div key={index} className="text-sm flex flex-wrap gap-2 items-center bg-white p-2 rounded border">
                        <Badge variant="outline">{id.scheme}</Badge>
                        <span className="font-mono text-gray-800">{id.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
