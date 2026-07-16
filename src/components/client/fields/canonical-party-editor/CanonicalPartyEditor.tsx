import React, { useState } from "react";
import { CanonicalPartyFormState } from "./state-mappers";
import { PartyIdentitySection } from "./PartyIdentitySection";
import { PartyContactSection } from "./PartyContactSection";
import { PartyRolesSection } from "./PartyRolesSection";
import { PartySourceIdentifiersSection } from "./PartySourceIdentifiersSection";
import { LegacyAddressWarning } from "./LegacyAddressWarning";
import { PartyAddressSection } from "./PartyAddressSection";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CanonicalPartyEditorProps {
    clientLEId: string;
    formState: CanonicalPartyFormState;
    onChange: (formState: CanonicalPartyFormState) => void;
    previewLabel?: string;
    disabled?: boolean;
    isNew?: boolean; // Determines if party type is editable
}

export function CanonicalPartyEditor({ clientLEId, formState, onChange, previewLabel, disabled, isNew = false }: CanonicalPartyEditorProps) {
    const handlePartyTypeChange = (newType: CanonicalPartyFormState['partyType']) => {
        if (!isNew) return;
        
        // Confirmation if they have entered identity data
        const hasIdentityData = formState.identity.forenames || formState.identity.surname || formState.identity.legalName || formState.identity.teamName;
        if (hasIdentityData) {
            if (!window.confirm("Changing the Party Type will clear the current identity fields. Are you sure?")) {
                return;
            }
        }

        onChange({
            ...formState,
            partyType: newType,
            // Reset identity fields and top-level addresses
            identity: {
                title: null,
                forenames: null,
                surname: null,
                legalName: null,
                teamName: null,
                nationality: [],
                placeOfBirth: null,
                dateOfBirth: { year: "", month: "", day: "" }
            },
            homeAddressRef: null,
            registeredAddressRef: null
        });
    };

    const setFormState = (updater: React.SetStateAction<CanonicalPartyFormState>) => {
        onChange(typeof updater === 'function' ? updater(formState) : updater);
    };

    return (
        <div className="space-y-8 max-w-3xl">
            {/* Header / Meta */}
            <div className="flex flex-col gap-4 p-4 bg-gray-50 border rounded-md">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{previewLabel}</h2>
                        <div className="text-sm text-gray-500 mt-1">
                            Status: 
                            <select
                                aria-label="Active Party Status"
                                disabled={disabled}
                                className="ml-2 bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                value={formState.isActiveParty === null ? "unspecified" : formState.isActiveParty ? "active" : "inactive"}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormState(prev => ({ ...prev, isActiveParty: val === "unspecified" ? null : val === "active" }));
                                }}
                            >
                                <option value="unspecified">Not specified</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase">Party Type</Label>
                    <RadioGroup 
                        disabled={disabled || !isNew}
                        value={formState.partyType} 
                        onValueChange={(val: any) => handlePartyTypeChange(val)}
                        className="flex gap-4"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="INDIVIDUAL" id="type-indiv" />
                            <Label htmlFor="type-indiv" className={(!isNew && formState.partyType !== 'INDIVIDUAL') ? 'text-gray-400' : ''}>Individual</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="ORGANISATION" id="type-org" />
                            <Label htmlFor="type-org" className={(!isNew && formState.partyType !== 'ORGANISATION') ? 'text-gray-400' : ''}>Organisation</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TEAM" id="type-team" />
                            <Label htmlFor="type-team" className={(!isNew && formState.partyType !== 'TEAM') ? 'text-gray-400' : ''}>Team</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="space-y-1 mt-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase">Known As (Alias/Trading Name)</Label>
                    <Input
                        disabled={disabled}
                        value={formState.knownAs || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormState(prev => ({ ...prev, knownAs: e.target.value }))}
                        placeholder="e.g. Acme trading"
                    />
                </div>
            </div>

            <LegacyAddressWarning state={formState} />
            
            <div className="border-t pt-6">
                {formState.partyType === 'INDIVIDUAL' && (
                    <PartyAddressSection
                        clientLEId={clientLEId}
                        label="Home Address"
                        currentRef={formState.homeAddressRef}
                        onChange={(ref) => setFormState(prev => ({ ...prev, homeAddressRef: ref }))}
                        disabled={disabled}
                    />
                )}
                {formState.partyType === 'ORGANISATION' && (
                    <PartyAddressSection
                        clientLEId={clientLEId}
                        label="Registered Address"
                        currentRef={formState.registeredAddressRef}
                        onChange={(ref) => setFormState(prev => ({ ...prev, registeredAddressRef: ref }))}
                        disabled={disabled}
                    />
                )}
                {formState.partyType === 'TEAM' && (
                    <PartyAddressSection
                        clientLEId={clientLEId}
                        label="Correspondence Address"
                        currentRef={formState.correspondenceAddressRef}
                        onChange={(ref) => setFormState(prev => ({ ...prev, correspondenceAddressRef: ref }))}
                        disabled={disabled}
                    />
                )}
            </div>

            <div className="border-t pt-6">
                <PartyIdentitySection 
                    state={formState} 
                    onChange={updates => setFormState(prev => ({ ...prev, identity: { ...prev.identity, ...updates } }))} 
                    disabled={disabled} 
                />
            </div>

            <div className="border-t pt-6">
                <PartyContactSection 
                    state={formState} 
                    onChange={updates => setFormState(prev => ({ ...prev, ...updates }))} 
                    disabled={disabled} 
                />
            </div>

            <div className="border-t pt-6">
                <PartyRolesSection 
                    clientLEId={clientLEId}
                    state={formState} 
                    onChange={updates => setFormState(prev => ({ ...prev, ...updates }))} 
                    disabled={disabled} 
                />
            </div>

            {formState.sourceIdentifiers.length > 0 && (
                <div className="border-t pt-6">
                    <PartySourceIdentifiersSection identifiers={formState.sourceIdentifiers} />
                </div>
            )}
        </div>
    );
}
