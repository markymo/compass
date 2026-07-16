import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CanonicalPartyFormState } from "./state-mappers";

interface PartyIdentitySectionProps {
    state: CanonicalPartyFormState;
    onChange: (updates: Partial<CanonicalPartyFormState['identity']>) => void;
    disabled?: boolean;
}

export function PartyIdentitySection({ state, onChange, disabled }: PartyIdentitySectionProps) {
    const isIndiv = state.partyType === 'INDIVIDUAL';
    const isTeam = state.partyType === 'TEAM';
    const isOrg = state.partyType === 'ORGANISATION';

    const update = (field: keyof CanonicalPartyFormState['identity'], val: any) => {
        onChange({ [field]: val });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
                Identity
            </h3>
            
            {isIndiv && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label>Title</Label>
                        <Input
                            disabled={disabled}
                            value={state.identity.title || ""}
                            onChange={e => update('title', e.target.value)}
                            placeholder="e.g. Mr, Mrs, Dr"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Forenames</Label>
                        <Input
                            disabled={disabled}
                            value={state.identity.forenames || ""}
                            onChange={e => update('forenames', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Surname</Label>
                        <Input
                            disabled={disabled}
                            value={state.identity.surname || ""}
                            onChange={e => update('surname', e.target.value)}
                        />
                    </div>
                </div>
            )}

            {isTeam && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Team Name</Label>
                        <Input
                            disabled={disabled}
                            value={state.identity.teamName || ""}
                            onChange={e => update('teamName', e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Location</Label>
                        <Input
                            disabled={disabled}
                            value={state.identity.location || ""}
                            onChange={e => update('location', e.target.value)}
                            placeholder="Optional free-text location"
                        />
                    </div>
                </div>
            )}

            {isOrg && (
                <div className="space-y-1">
                    <Label>Legal Name</Label>
                    <Input
                        disabled={disabled}
                        value={state.identity.legalName || ""}
                        onChange={e => update('legalName', e.target.value)}
                    />
                </div>
            )}

            {isIndiv && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Date of Birth</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                disabled={disabled}
                                placeholder="DD"
                                className="w-16 text-center"
                                value={state.identity.dateOfBirth.day}
                                onChange={e => update('dateOfBirth', { ...state.identity.dateOfBirth, day: e.target.value })}
                            />
                            <span className="text-gray-400">/</span>
                            <Input
                                disabled={disabled}
                                placeholder="MM"
                                className="w-16 text-center"
                                value={state.identity.dateOfBirth.month}
                                onChange={e => update('dateOfBirth', { ...state.identity.dateOfBirth, month: e.target.value })}
                            />
                            <span className="text-gray-400">/</span>
                            <Input
                                disabled={disabled}
                                placeholder="YYYY"
                                className="w-24 text-center"
                                value={state.identity.dateOfBirth.year}
                                onChange={e => update('dateOfBirth', { ...state.identity.dateOfBirth, year: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>Place of Birth</Label>
                        <Input
                            disabled={disabled}
                            value={state.identity.placeOfBirth || ""}
                            onChange={e => update('placeOfBirth', e.target.value)}
                        />
                    </div>
                </div>
            )}

            {isIndiv && (
                <div className="space-y-1">
                    <Label>Nationality (comma-separated)</Label>
                    <Input
                        disabled={disabled}
                        value={state.identity.nationality.join(", ")}
                        onChange={e => {
                            const raw = e.target.value;
                            const arr = raw.split(",").map(s => s.trim()).filter(Boolean);
                            update('nationality', arr);
                        }}
                        placeholder="e.g. GB, US"
                    />
                </div>
            )}
        </div>
    );
}
