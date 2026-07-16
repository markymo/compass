import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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
                <ul className="space-y-2 mt-3">
                    {state.legacyTopLevelAddressDiagnostics.map((diag, i) => {
                        const isResolved = 
                            (diag === 'homeAddress' && !!state.homeAddressRef) ||
                            (diag === 'correspondenceAddress' && !!state.correspondenceAddressRef);
                        
                        return (
                            <li key={`top-${i}`} className="flex items-start gap-2">
                                {isResolved ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 ml-1" />}
                                <span className={isResolved ? "line-through text-emerald-700/80" : ""}>Legacy {diag}</span>
                                {isResolved && <span className="text-emerald-700 text-xs font-medium ml-1">(Resolved)</span>}
                            </li>
                        );
                    })}
                    {state.roles.filter(r => r.legacyEmbeddedAddressDiagnostic).map((role, i) => {
                        const isResolved = !!role.correspondenceAddressRef;
                        return (
                            <li key={`role-${i}`} className="flex items-start gap-2">
                                {isResolved ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 ml-1" />}
                                <span className={isResolved ? "line-through text-emerald-700/80" : ""}>
                                    Role Address (Legacy {role.legacyEmbeddedAddressDiagnostic})
                                    {role.roleTitle || role.roleType ? ` on ${role.roleTitle || role.roleType}` : ''}
                                </span>
                                {isResolved && <span className="text-emerald-700 text-xs font-medium ml-1">(Resolved)</span>}
                            </li>
                        );
                    })}
                </ul>
                <p className="mt-4">
                    Selecting a genuine saved address reference is the only way to retain an address association.
                </p>
            </div>
        </div>
    );
}
