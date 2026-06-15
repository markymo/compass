import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, User, Phone, Briefcase, IdCard } from "lucide-react";
import { PartyValue, PartyPhone, PartyRole } from "@/lib/master-data/party-value";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface PersonOrContactValueEditorProps {
    value: PartyValue;
    onChange: (newValue: PartyValue) => void;
    disabled?: boolean;
    fieldNo?: number;
}

const SUBTYPES_BY_TYPE = {
    INDIVIDUAL: ["PERSON", "CONTACT"],
    ORGANISATION: ["COMPANY", "TRUST", "FUND", "PARTNERSHIP", "GOVERNMENT_BODY", "TEAM", "DISTRIBUTION_LIST", "OTHER"],
    UNKNOWN: ["OTHER"]
};

const DEFAULT_SUBTYPE_BY_TYPE = {
    INDIVIDUAL: "PERSON",
    ORGANISATION: "COMPANY",
    UNKNOWN: "OTHER"
};

const SUBTYPE_LABELS: Record<string, string> = {
    PERSON: "Person",
    CONTACT: "Contact",
    COMPANY: "Company",
    TRUST: "Trust",
    FUND: "Fund",
    PARTNERSHIP: "Partnership",
    GOVERNMENT_BODY: "Government Body",
    TEAM: "Team",
    DISTRIBUTION_LIST: "Distribution List",
    OTHER: "Other"
};

export function PersonOrContactValueEditor({ value, onChange, disabled, fieldNo }: PersonOrContactValueEditorProps) {
    // ── Legacy Data Migration on Mount ──
    const safeValue = useMemo(() => {
        const migrated = { ...value };
        const anyVal = value as any;
        if (!migrated.forenames && anyVal.firstName) migrated.forenames = anyVal.firstName;
        if (!migrated.surname && anyVal.lastName) migrated.surname = anyVal.lastName;
        if (!migrated.roles) migrated.roles = [];
        if (!migrated.nationality) migrated.nationality = [];
        if (!migrated.contactType) migrated.contactType = "PERSON";

        // Protect Field 63 UX: force INDIVIDUAL / PERSON
        if (fieldNo === 63) {
            migrated.partyType = "INDIVIDUAL";
            migrated.partySubType = "PERSON";
            migrated.contactType = "PERSON";
        } else {
            // Apply backward compatibility mappings if missing
            if (!migrated.partyType) {
                if (migrated.contactType === "PERSON") {
                    migrated.partyType = "INDIVIDUAL";
                    migrated.partySubType = migrated.partySubType || "PERSON";
                } else {
                    migrated.partyType = "INDIVIDUAL";
                    migrated.partySubType = migrated.partySubType || "CONTACT";
                }
            }
        }
        return migrated;
    }, [value, fieldNo]);

    const updateField = (field: keyof PartyValue, val: any) => {
        onChange({ ...safeValue, [field]: val });
    };

    const handlePartyTypeChange = (newType: "INDIVIDUAL" | "ORGANISATION" | "UNKNOWN") => {
        const allowed = SUBTYPES_BY_TYPE[newType];
        const currentSub = safeValue.partySubType;
        const isStillValid = currentSub && allowed.includes(currentSub);
        const targetSub = isStillValid ? currentSub : DEFAULT_SUBTYPE_BY_TYPE[newType];

        let newContactType = safeValue.contactType;
        if (newType === "INDIVIDUAL") {
            newContactType = targetSub === "CONTACT" ? "CONTACT" : "PERSON";
        } else {
            newContactType = "CONTACT";
        }

        onChange({
            ...safeValue,
            partyType: newType,
            partySubType: targetSub as any,
            contactType: newContactType
        });
    };

    const handlePartySubTypeChange = (newSub: string) => {
        let newContactType = safeValue.contactType;
        if (safeValue.partyType === "INDIVIDUAL") {
            newContactType = newSub === "CONTACT" ? "CONTACT" : "PERSON";
        } else {
            newContactType = "CONTACT";
        }

        onChange({
            ...safeValue,
            partySubType: newSub as any,
            contactType: newContactType
        });
    };

    const updateDob = (field: "year" | "month" | "day", val: string) => {
        const numVal = val ? parseInt(val, 10) : null;
        const newDob = {
            year: safeValue.dateOfBirth?.year ?? null,
            month: safeValue.dateOfBirth?.month ?? null,
            day: safeValue.dateOfBirth?.day ?? null,
            [field]: numVal
        };
        const hasValues = newDob.year !== null || newDob.month !== null || newDob.day !== null;
        onChange({
            ...safeValue,
            dateOfBirth: hasValues ? newDob : null
        });
    };

    const updateRole = (index: number, field: keyof PartyRole, val: any) => {
        const newRoles = [...(safeValue.roles || [])];
        let cleanedVal = val;
        if ((field === "appointedOn" || field === "resignedOn") && val === "") {
            cleanedVal = null;
        }
        newRoles[index] = { ...newRoles[index], [field]: cleanedVal };
        onChange({ ...safeValue, roles: newRoles });
    };

    const addRole = () => {
        const newRoles = [...(safeValue.roles || []), {
            roleType: null,
            roleTitle: null,
            company: null,
            isActiveRole: true,
            appointedOn: null,
            resignedOn: null,
            natureOfControl: []
        } as unknown as PartyRole];
        onChange({ ...safeValue, roles: newRoles });
    };

    const removeRole = (index: number) => {
        const newRoles = [...(safeValue.roles || [])];
        newRoles.splice(index, 1);
        onChange({ ...safeValue, roles: newRoles });
    };

    const updateNationality = (val: string) => {
        const arr = val.split(",").map(s => s.trim()).filter(Boolean);
        updateField("nationality", arr);
    };

    const updatePhone = (index: number, field: keyof PartyPhone, val: any) => {
        const newPhones = [...(safeValue.phones || [])];
        newPhones[index] = { ...newPhones[index], [field]: val };
        updateField("phones", newPhones);
    };

    const addPhone = () => {
        const newPhones = [...(safeValue.phones || []), {
            type: "MOBILE",
            number: ""
        } as PartyPhone];
        updateField("phones", newPhones);
    };

    const removePhone = (index: number) => {
        const newPhones = [...(safeValue.phones || [])];
        newPhones.splice(index, 1);
        updateField("phones", newPhones);
    };

    return (
        <div className="space-y-8">
            {/* Conditional Type Selectors (hidden for Field 63 Directors) */}
            {fieldNo !== 63 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Party Type</span>
                        <RadioGroup
                            disabled={disabled}
                            value={safeValue.partyType || "INDIVIDUAL"}
                            onValueChange={(val) => handlePartyTypeChange(val as any)}
                            className="flex items-center gap-6 h-9"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="INDIVIDUAL" id="partyType-individual" className="h-4.5 w-4.5 text-indigo-600 focus:ring-indigo-500" />
                                <Label htmlFor="partyType-individual" className="text-sm font-medium text-slate-700 cursor-pointer select-none">Individual</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="ORGANISATION" id="partyType-organisation" className="h-4.5 w-4.5 text-indigo-600 focus:ring-indigo-500" />
                                <Label htmlFor="partyType-organisation" className="text-sm font-medium text-slate-700 cursor-pointer select-none">Organisation</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="UNKNOWN" id="partyType-unknown" className="h-4.5 w-4.5 text-indigo-600 focus:ring-indigo-500" />
                                <Label htmlFor="partyType-unknown" className="text-sm font-medium text-slate-700 cursor-pointer select-none">Unknown</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Party Subtype</label>
                        <select
                            disabled={disabled}
                            value={safeValue.partySubType || ""}
                            onChange={(e) => handlePartySubTypeChange(e.target.value)}
                            className="w-full h-9 text-sm rounded-md border border-slate-200 bg-white px-3 py-1 outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-xs transition-colors duration-150"
                        >
                            {SUBTYPES_BY_TYPE[safeValue.partyType || "INDIVIDUAL"].map((sub) => (
                                <option key={sub} value={sub}>
                                    {SUBTYPE_LABELS[sub] || sub}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Section: Identity */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
                    <User className="h-4.5 w-4.5 text-slate-500" />
                    <h4 className="text-sm font-bold tracking-tight text-slate-800">Identity Details</h4>
                </div>

                {safeValue.partyType === "ORGANISATION" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Organisation Name</label>
                            <Input disabled={disabled} value={safeValue.organisationName || ""} onChange={e => updateField("organisationName", e.target.value || null)} className="h-9 text-sm bg-white" placeholder="e.g. Acme Corp" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Display Name / Alias</label>
                            <Input disabled={disabled} value={safeValue.displayName || ""} onChange={e => updateField("displayName", e.target.value || null)} className="h-9 text-sm bg-white" placeholder="e.g. Acme" />
                        </div>
                    </div>
                ) : safeValue.partyType === "UNKNOWN" ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Organisation Name</label>
                                <Input disabled={disabled} value={safeValue.organisationName || ""} onChange={e => updateField("organisationName", e.target.value || null)} className="h-9 text-sm bg-white" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Display Name</label>
                                <Input disabled={disabled} value={safeValue.displayName || ""} onChange={e => updateField("displayName", e.target.value || null)} className="h-9 text-sm bg-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Title</label>
                                <Input disabled={disabled} value={safeValue.title || ""} onChange={e => updateField("title", e.target.value)} className="h-9 text-sm bg-white" placeholder="Mr, Dr..." />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Forenames</label>
                                <Input disabled={disabled} value={safeValue.forenames || ""} onChange={e => updateField("forenames", e.target.value)} className="h-9 text-sm bg-white" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Surname</label>
                                <Input disabled={disabled} value={safeValue.surname || ""} onChange={e => updateField("surname", e.target.value)} className="h-9 text-sm bg-white" />
                            </div>
                        </div>
                    </div>
                ) : (
                    // INDIVIDUAL (or default)
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Title</label>
                            <Input disabled={disabled} value={safeValue.title || ""} onChange={e => updateField("title", e.target.value)} className="h-9 text-sm bg-white" placeholder="Mr, Dr..." />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Forenames</label>
                            <Input disabled={disabled} value={safeValue.forenames || ""} onChange={e => updateField("forenames", e.target.value)} className="h-9 text-sm bg-white" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Surname</label>
                            <Input disabled={disabled} value={safeValue.surname || ""} onChange={e => updateField("surname", e.target.value)} className="h-9 text-sm bg-white" />
                        </div>
                    </div>
                )}

                {/* Individual specific fields (Nationality, place of birth, residence) */}
                {safeValue.partyType !== "ORGANISATION" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nationality (comma separated)</label>
                            <Input disabled={disabled} value={safeValue.nationality?.join(", ") || ""} onChange={e => updateNationality(e.target.value)} className="h-9 text-sm bg-white" placeholder="e.g. British, French" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Country of Residence</label>
                            <Input disabled={disabled} value={safeValue.countryOfResidence || ""} onChange={e => updateField("countryOfResidence", e.target.value)} className="h-9 text-sm bg-white" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Place of Birth</label>
                            <Input disabled={disabled} value={safeValue.placeOfBirth || ""} onChange={e => updateField("placeOfBirth", e.target.value)} className="h-9 text-sm bg-white" />
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-6 pt-2">
                    {/* DOB (hidden for Organisation) */}
                    {safeValue.partyType !== "ORGANISATION" && (
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Date of Birth</label>
                            <div className="flex gap-2">
                                <Input disabled={disabled} placeholder="YYYY" value={safeValue.dateOfBirth?.year || ""} onChange={e => updateDob("year", e.target.value)} className="h-9 text-sm bg-white w-20 text-center" />
                                <Input disabled={disabled} placeholder="MM" value={safeValue.dateOfBirth?.month || ""} onChange={e => updateDob("month", e.target.value)} className="h-9 text-sm bg-white w-16 text-center" />
                                <Input disabled={disabled} placeholder="DD" value={safeValue.dateOfBirth?.day || ""} onChange={e => updateDob("day", e.target.value)} className="h-9 text-sm bg-white w-16 text-center" />
                            </div>
                        </div>
                    )}

                    {/* Status Flag */}
                    <div className="flex items-center h-full sm:pt-6">
                        <label className="flex items-center gap-2 cursor-pointer select-none group">
                            <Checkbox 
                                disabled={disabled}
                                checked={safeValue.isActivePersonOrContact ?? false} 
                                onCheckedChange={v => updateField("isActivePersonOrContact", v === true)} 
                                className="h-4.5 w-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider group-hover:text-slate-900 transition-colors">Is Active Party</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Section: Contact Details */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
                    <Phone className="h-4.5 w-4.5 text-slate-500" />
                    <h4 className="text-sm font-bold tracking-tight text-slate-800">Contact Details</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                        <Input 
                            disabled={disabled} 
                            type="email" 
                            placeholder="email@example.com"
                            value={safeValue.email || ""} 
                            onChange={e => updateField("email", e.target.value || null)} 
                            className="h-9 text-sm bg-white" 
                        />
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phone Numbers</label>
                        {!disabled && (
                            <Button 
                                type="button"
                                variant="ghost" 
                                size="sm" 
                                onClick={addPhone} 
                                className="h-7 px-2.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-md transition-all duration-150"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Phone
                            </Button>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        {safeValue.phones?.map((phone, i) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/50">
                                <select
                                    disabled={disabled}
                                    value={phone.type}
                                    onChange={(e) => updatePhone(i, "type", e.target.value as any)}
                                    className="h-9 text-sm rounded-md border border-slate-200 bg-white px-2 py-1 outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="MOBILE">Mobile</option>
                                    <option value="LANDLINE">Landline</option>
                                    <option value="OTHER">Other</option>
                                </select>
                                <Input
                                    disabled={disabled}
                                    placeholder="Phone number"
                                    value={phone.number || ""}
                                    onChange={(e) => updatePhone(i, "number", e.target.value)}
                                    className="h-9 text-sm bg-white flex-1"
                                />
                                {!disabled && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removePhone(i)}
                                        className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                    >
                                        <Trash2 className="h-4.5 w-4.5" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        {(!safeValue.phones || safeValue.phones.length === 0) && (
                            <div className="text-xs text-slate-400 italic bg-slate-50/30 py-3 text-center border border-dashed border-slate-200/60 rounded-lg">
                                No phone numbers added yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Section: Roles */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 text-slate-900">
                        <Briefcase className="h-4.5 w-4.5 text-slate-500" />
                        <h4 className="text-sm font-bold tracking-tight text-slate-800">Roles</h4>
                    </div>
                    {!disabled && (
                        <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            onClick={addRole} 
                            className="h-7 px-2.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-md transition-all duration-150"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Role
                        </Button>
                    )}
                </div>

                <div className="space-y-4">
                    {safeValue.roles?.map((role: PartyRole, i: number) => (
                        <div key={i} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/80 shadow-xs relative space-y-4">
                            {!disabled && (
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => removeRole(i)} 
                                    className="absolute right-3 top-3 h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mr-8">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role Type</label>
                                    <Input disabled={disabled} value={role.roleType || ""} onChange={e => updateRole(i, "roleType", e.target.value)} className="h-9 text-sm bg-white" placeholder="e.g. director, psc" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role Title</label>
                                    <Input disabled={disabled} value={role.roleTitle || ""} onChange={e => updateRole(i, "roleTitle", e.target.value)} className="h-9 text-sm bg-white" placeholder="e.g. Managing Director" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Appointed On</label>
                                    <Input type="date" disabled={disabled} value={role.appointedOn || ""} onChange={e => updateRole(i, "appointedOn", e.target.value)} className="h-9 text-sm bg-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resigned On</label>
                                    <Input type="date" disabled={disabled} value={role.resignedOn || ""} onChange={e => updateRole(i, "resignedOn", e.target.value)} className="h-9 text-sm bg-white" />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/70 p-3 rounded-lg border border-slate-100 gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none group">
                                    <Checkbox 
                                        disabled={disabled}
                                        checked={role.isActiveRole ?? true} 
                                        onCheckedChange={v => updateRole(i, "isActiveRole", v === true)} 
                                        className="h-4.5 w-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    />
                                    <span className="font-bold text-slate-600 uppercase text-[10px] tracking-wider group-hover:text-slate-900 transition-colors">Active Role</span>
                                </label>
                                
                                {role.company && (
                                    <div className="text-slate-500 flex items-center gap-2 text-xs">
                                        <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Company:</span>
                                        <span className="font-semibold bg-slate-100 px-2 py-1 rounded text-slate-700">
                                            {role.company.name || role.company.externalId || "Unknown"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {(!safeValue.roles || safeValue.roles.length === 0) && (
                        <div className="text-xs text-slate-400 italic bg-slate-50/30 py-4 text-center border border-dashed border-slate-200/60 rounded-lg">
                            No roles assigned to this party.
                        </div>
                    )}
                </div>
            </div>

            {/* Section: Source Identifiers (Read-only) */}
            {safeValue.sourceIdentifiers && safeValue.sourceIdentifiers.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
                        <IdCard className="h-4.5 w-4.5 text-slate-500" />
                        <h4 className="text-sm font-bold tracking-tight text-slate-800">Source Identifiers</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 bg-slate-50/30 p-3 rounded-lg border border-slate-100">
                        {safeValue.sourceIdentifiers.map((si, i) => (
                            <span key={i} className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200/80 shadow-2xs">
                                <span className="font-mono mr-1 text-[10px] text-slate-400 uppercase tracking-wider">{si.scheme}:</span>
                                <span className="text-slate-800 font-mono">{si.value}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
