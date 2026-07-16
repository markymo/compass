import React from "react";
import { AlertTriangle } from "lucide-react";
import { CanonicalPartyFormState } from "./state-mappers";

interface LegacyAddressWarningProps {
    state: CanonicalPartyFormState;
}

export function LegacyAddressWarning({ state }: LegacyAddressWarningProps) {
    const hasTopLevelLegacyAddresses = state.legacyTopLevelAddressDiagnostics.length > 0;
    const hasRoleLevelLegacyAddresses = state.roles.some(r => r.legacyEmbeddedAddressDiagnostic !== null);

    if (!hasTopLevelLegacyAddresses && !hasRoleLevelLegacyAddresses) return null;

    return (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md flex gap-3 text-amber-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-2 text-sm">
                <p className="font-semibold">This Party contains old-format compatibility addresses.</p>
                <p>
                    These addresses are not canonical CCAddress references and cannot be edited here.
                    <strong> If you save any changes to this Party, these old-format addresses will NOT be carried into the saved version and will be lost.</strong>
                </p>
                <ul className="list-disc pl-5 space-y-1 mt-2 text-amber-900/80">
                    {state.legacyTopLevelAddressDiagnostics.map((diag, i) => (
                        <li key={`top-${i}`}>Legacy {diag}</li>
                    ))}
                    {state.roles.filter(r => r.legacyEmbeddedAddressDiagnostic).map((role, i) => (
                        <li key={`role-${i}`}>
                            Role Address (Legacy {role.legacyEmbeddedAddressDiagnostic})
                            {role.roleTitle || role.roleType ? ` on ${role.roleTitle || role.roleType}` : ''}
                        </li>
                    ))}
                </ul>
                <p className="mt-2">
                    Selecting a genuine saved address reference is the only way to retain an address association (coming in a future update).
                </p>
            </div>
        </div>
    );
}
