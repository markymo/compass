import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { CanonicalPartyFormState } from "./state-mappers";
import { PartyAddressRef } from "../CCAddressSelector";
import { Badge } from "@/components/ui/badge";
import { PartyAddressSection } from "./PartyAddressSection";

interface PartyRolesSectionProps {
    clientLEId: string;
    state: CanonicalPartyFormState;
    onChange: (updates: Partial<Pick<CanonicalPartyFormState, 'roles'>>) => void;
    disabled?: boolean;
    /** Optional callback to trigger address creation, receiving a callback to set the form state with the resulting reference */
    onRequestCreateAddress?: (onCreated: (ref: PartyAddressRef) => void) => void;
}

export function PartyRolesSection({ clientLEId, state, onChange, disabled, onRequestCreateAddress }: PartyRolesSectionProps) {
    const addRole = () => {
        onChange({
            roles: [...state.roles, {
                rowId: crypto.randomUUID(),
                roleType: null,
                roleTitle: null,
                isActiveRole: null,
                appointedOn: null,
                resignedOn: null,
                company: { name: null, externalId: null, externalIdScheme: null, onProCompanyId: null },
                natureOfControl: [],
                correspondenceAddressRef: null,
                legacyEmbeddedAddressDiagnostic: null,
                legacyEmbeddedAddressRaw: null
            }]
        });
    };

    const removeRole = (rowId: string) => {
        onChange({ roles: state.roles.filter(r => r.rowId !== rowId) });
    };

    const updateRole = (rowId: string, updates: Partial<CanonicalPartyFormState['roles'][0]>) => {
        onChange({
            roles: state.roles.map(r => r.rowId === rowId ? { ...r, ...updates } : r)
        });
    };

    const updateRoleCompany = (rowId: string, companyUpdates: Partial<CanonicalPartyFormState['roles'][0]['company']>) => {
        onChange({
            roles: state.roles.map(r => r.rowId === rowId ? { ...r, company: { ...r.company, ...companyUpdates } } : r)
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Roles</h3>
                <Button variant="outline" size="sm" onClick={addRole} disabled={disabled}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Role
                </Button>
            </div>
            
            {state.roles.length === 0 && (
                <p className="text-sm text-gray-500 italic">No roles specified</p>
            )}

            {state.roles.map((role, index) => (
                <div key={role.rowId} className="p-4 border rounded-md space-y-4 relative bg-gray-50/50">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        aria-label="Remove role"
                        onClick={() => removeRole(role.rowId)} 
                        disabled={disabled}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Role Type</Label>
                            <Input
                                disabled={disabled}
                                value={role.roleType || ""}
                                onChange={e => updateRole(role.rowId, { roleType: e.target.value })}
                                placeholder="e.g. director, shareholder"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Role Title</Label>
                            <Input
                                disabled={disabled}
                                value={role.roleTitle || ""}
                                onChange={e => updateRole(role.rowId, { roleTitle: e.target.value })}
                                placeholder="e.g. CEO, Managing Director"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Status</Label>
                            <select
                                disabled={disabled}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={role.isActiveRole === null ? "unspecified" : role.isActiveRole ? "active" : "inactive"}
                                onChange={e => {
                                    const val = e.target.value;
                                    updateRole(role.rowId, { isActiveRole: val === "unspecified" ? null : val === "active" });
                                }}
                            >
                                <option value="unspecified">Not specified</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label>Appointed On</Label>
                            <Input
                                disabled={disabled}
                                type="date"
                                value={role.appointedOn || ""}
                                onChange={e => updateRole(role.rowId, { appointedOn: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Resigned On</Label>
                            <Input
                                disabled={disabled}
                                type="date"
                                value={role.resignedOn || ""}
                                onChange={e => updateRole(role.rowId, { resignedOn: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs text-gray-500 uppercase font-semibold">Company Context</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Company Name</Label>
                                <Input
                                    disabled={disabled}
                                    value={role.company.name || ""}
                                    onChange={e => updateRoleCompany(role.rowId, { name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>External ID</Label>
                                <Input
                                    disabled={disabled}
                                    value={role.company.externalId || ""}
                                    onChange={e => updateRoleCompany(role.rowId, { externalId: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <PartyAddressSection
                            clientLEId={clientLEId}
                            label="Role Correspondence Address"
                            currentRef={role.correspondenceAddressRef || null}
                            onChange={(ref) => updateRole(role.rowId, { correspondenceAddressRef: ref })}
                            disabled={disabled}
                            onCreateAddress={onRequestCreateAddress ? () => onRequestCreateAddress((ref) => updateRole(role.rowId, { correspondenceAddressRef: ref })) : undefined}
                        />
                    </div>

                    {role.natureOfControl.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs text-gray-500 uppercase font-semibold">Preserved Read-Only Data</Label>
                            <div className="text-sm flex flex-wrap gap-1">
                                <span className="font-medium mr-1">Nature of Control:</span>
                                {role.natureOfControl.map((noc, i) => (
                                    <Badge key={i} variant="secondary">{noc}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
