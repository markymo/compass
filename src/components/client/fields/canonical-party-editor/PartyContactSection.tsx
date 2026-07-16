import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { CanonicalPartyFormState } from "./state-mappers";

interface PartyContactSectionProps {
    state: CanonicalPartyFormState;
    onChange: (updates: Partial<Pick<CanonicalPartyFormState, 'emails' | 'phones'>>) => void;
    disabled?: boolean;
}

export function PartyContactSection({ state, onChange, disabled }: PartyContactSectionProps) {
    const addEmail = () => {
        onChange({ emails: [...state.emails, { rowId: crypto.randomUUID(), value: "" }] });
    };

    const removeEmail = (rowId: string) => {
        onChange({ emails: state.emails.filter(e => e.rowId !== rowId) });
    };

    const updateEmail = (rowId: string, value: string) => {
        onChange({ emails: state.emails.map(e => e.rowId === rowId ? { ...e, value } : e) });
    };

    const addPhone = () => {
        onChange({ phones: [...state.phones, { rowId: crypto.randomUUID(), type: "mobile", number: "" }] });
    };

    const removePhone = (rowId: string) => {
        onChange({ phones: state.phones.filter(p => p.rowId !== rowId) });
    };

    const updatePhone = (rowId: string, updates: Partial<{ type: string; number: string }>) => {
        onChange({ phones: state.phones.map(p => p.rowId === rowId ? { ...p, ...updates } : p) });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Emails</h3>
                    <Button variant="outline" size="sm" onClick={addEmail} disabled={disabled}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Email
                    </Button>
                </div>
                {state.emails.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No emails provided</p>
                )}
                {state.emails.map(email => (
                    <div key={email.rowId} className="flex items-center gap-2">
                        <Input
                            disabled={disabled}
                            value={email.value}
                            onChange={e => updateEmail(email.rowId, e.target.value)}
                            placeholder="Email address"
                            type="email"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeEmail(email.rowId)} disabled={disabled}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Phones</h3>
                    <Button variant="outline" size="sm" onClick={addPhone} disabled={disabled}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Phone
                    </Button>
                </div>
                {state.phones.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No phones provided</p>
                )}
                {state.phones.map(phone => (
                    <div key={phone.rowId} className="flex items-center gap-2">
                        <select
                            disabled={disabled}
                            className="flex h-10 w-32 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={phone.type}
                            onChange={e => updatePhone(phone.rowId, { type: e.target.value })}
                        >
                            <option value="mobile">Mobile</option>
                            <option value="work">Work</option>
                            <option value="home">Home</option>
                            <option value="other">Other</option>
                        </select>
                        <Input
                            disabled={disabled}
                            value={phone.number}
                            onChange={e => updatePhone(phone.rowId, { number: e.target.value })}
                            placeholder="Phone number"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removePhone(phone.rowId)} disabled={disabled}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
