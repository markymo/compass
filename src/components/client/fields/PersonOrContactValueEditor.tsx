import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { PersonOrContactValue, PersonOrContactRole, PersonOrContactPhone } from "@/lib/master-data/person-or-contact-value";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface PersonOrContactValueEditorProps {
    value: PersonOrContactValue;
    onChange: (newValue: PersonOrContactValue) => void;
    disabled?: boolean;
}

export function PersonOrContactValueEditor({ value, onChange, disabled }: PersonOrContactValueEditorProps) {
    // ── Legacy Data Migration on Mount ──
    const safeValue = useMemo(() => {
        const migrated = { ...value };
        const anyVal = value as any;
        if (!migrated.forenames && anyVal.firstName) migrated.forenames = anyVal.firstName;
        if (!migrated.surname && anyVal.lastName) migrated.surname = anyVal.lastName;
        if (!migrated.roles) migrated.roles = [];
        if (!migrated.nationality) migrated.nationality = [];
        if (!migrated.contactType) migrated.contactType = 'PERSON';
        return migrated;
    }, [value]);

    const updateField = (field: keyof PersonOrContactValue, val: any) => {
        onChange({ ...safeValue, [field]: val });
    };

    const updateDob = (field: 'year' | 'month' | 'day', val: string) => {
        const numVal = val ? parseInt(val, 10) : null;
        onChange({
            ...safeValue,
            dateOfBirth: {
                year: safeValue.dateOfBirth?.year ?? null,
                month: safeValue.dateOfBirth?.month ?? null,
                day: safeValue.dateOfBirth?.day ?? null,
                [field]: numVal
            }
        });
    };

    const updateRole = (index: number, field: keyof PersonOrContactRole, val: any) => {
        const newRoles = [...(safeValue.roles || [])];
        newRoles[index] = { ...newRoles[index], [field]: val };
        onChange({ ...value, roles: newRoles });
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
        } as unknown as PersonOrContactRole];
        onChange({ ...value, roles: newRoles });
    };

    const removeRole = (index: number) => {
        const newRoles = [...(safeValue.roles || [])];
        newRoles.splice(index, 1);
        onChange({ ...value, roles: newRoles });
    };

    const updateNationality = (val: string) => {
        const arr = val.split(',').map(s => s.trim()).filter(Boolean);
        updateField('nationality', arr);
    };

    const updatePhone = (index: number, field: keyof PersonOrContactPhone, val: any) => {
        const newPhones = [...(safeValue.phones || [])];
        newPhones[index] = { ...newPhones[index], [field]: val };
        updateField('phones', newPhones);
    };

    const addPhone = () => {
        const newPhones = [...(safeValue.phones || []), {
            type: 'MOBILE',
            number: ''
        } as PersonOrContactPhone];
        updateField('phones', newPhones);
    };

    const removePhone = (index: number) => {
        const newPhones = [...(safeValue.phones || [])];
        newPhones.splice(index, 1);
        updateField('phones', newPhones);
    };

    return (
        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Contact Type</span>
                    <RadioGroup
                        disabled={disabled}
                        value={safeValue.contactType || 'PERSON'}
                        onValueChange={(val) => updateField('contactType', val as 'PERSON' | 'CONTACT')}
                        className="flex items-center gap-4 h-8"
                    >
                        <div className="flex items-center space-x-1.5">
                            <RadioGroupItem value="PERSON" id="contactType-person" className="h-4 w-4" />
                            <Label htmlFor="contactType-person" className="text-xs font-medium text-slate-700 cursor-pointer select-none">Person</Label>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <RadioGroupItem value="CONTACT" id="contactType-contact" className="h-4 w-4" />
                            <Label htmlFor="contactType-contact" className="text-xs font-medium text-slate-700 cursor-pointer select-none">Contact</Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Title</label>
                    <Input disabled={disabled} value={safeValue.title || ''} onChange={e => updateField('title', e.target.value)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Forenames</label>
                    <Input disabled={disabled} value={safeValue.forenames || ''} onChange={e => updateField('forenames', e.target.value)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Surname</label>
                    <Input disabled={disabled} value={safeValue.surname || ''} onChange={e => updateField('surname', e.target.value)} className="h-8 text-xs bg-white" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Nationality (comma separated)</label>
                    <Input disabled={disabled} value={safeValue.nationality?.join(', ') || ''} onChange={e => updateNationality(e.target.value)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Country of Residence</label>
                    <Input disabled={disabled} value={safeValue.countryOfResidence || ''} onChange={e => updateField('countryOfResidence', e.target.value)} className="h-8 text-xs bg-white" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Place of Birth</label>
                    <Input disabled={disabled} value={safeValue.placeOfBirth || ''} onChange={e => updateField('placeOfBirth', e.target.value)} className="h-8 text-xs bg-white" />
                </div>
            </div>

            <div className="flex gap-6 items-center">
                <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase block">Date of Birth</label>
                    <div className="flex gap-2">
                        <Input disabled={disabled} placeholder="YYYY" value={safeValue.dateOfBirth?.year || ''} onChange={e => updateDob('year', e.target.value)} className="h-8 text-xs bg-white w-20" />
                        <Input disabled={disabled} placeholder="MM" value={safeValue.dateOfBirth?.month || ''} onChange={e => updateDob('month', e.target.value)} className="h-8 text-xs bg-white w-16" />
                        <Input disabled={disabled} placeholder="DD" value={safeValue.dateOfBirth?.day || ''} onChange={e => updateDob('day', e.target.value)} className="h-8 text-xs bg-white w-16" />
                    </div>
                </div>

                <div className="space-y-2 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox 
                            disabled={disabled}
                            checked={safeValue.isActivePersonOrContact ?? false} 
                            onCheckedChange={v => updateField('isActivePersonOrContact', v === true)} 
                        />
                        <span className="text-xs font-semibold text-slate-600 uppercase">Is Active Person/Contact</span>
                    </label>
                </div>
            </div>

            {/* Contact Details (Email + Phones) */}
            <div className="space-y-3 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Contact Details</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Email</label>
                        <Input 
                            disabled={disabled} 
                            type="email" 
                            placeholder="email@example.com"
                            value={safeValue.email || ''} 
                            onChange={e => updateField('email', e.target.value || null)} 
                            className="h-8 text-xs bg-white" 
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Phone Numbers</label>
                        {!disabled && (
                            <Button 
                                type="button"
                                variant="ghost" 
                                size="sm" 
                                onClick={addPhone} 
                                className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            >
                                <Plus className="h-3 w-3 mr-1" /> Add Phone
                            </Button>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        {safeValue.phones?.map((phone, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <select
                                    disabled={disabled}
                                    value={phone.type}
                                    onChange={(e) => updatePhone(i, 'type', e.target.value as any)}
                                    className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2 py-1 outline-none focus:border-indigo-300"
                                >
                                    <option value="MOBILE">Mobile</option>
                                    <option value="LANDLINE">Landline</option>
                                    <option value="OTHER">Other</option>
                                </select>
                                <Input
                                    disabled={disabled}
                                    placeholder="Number"
                                    value={phone.number || ''}
                                    onChange={(e) => updatePhone(i, 'number', e.target.value)}
                                    className="h-8 text-xs bg-white flex-1"
                                />
                                {!disabled && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removePhone(i)}
                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        {(!safeValue.phones || safeValue.phones.length === 0) && (
                            <div className="text-xs text-slate-400 italic">No phone numbers.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Roles</label>
                    {!disabled && (
                        <Button variant="ghost" size="sm" onClick={addRole} className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                            <Plus className="h-3 w-3 mr-1" /> Add Role
                        </Button>
                    )}
                </div>
                {safeValue.roles?.map((role: PersonOrContactRole, i: number) => (
                    <div key={i} className="pl-3 ml-2 border-l-2 border-indigo-100 space-y-3 relative pb-2">
                        {!disabled && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeRole(i)} 
                                className="absolute -left-3 top-0 h-5 w-5 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 -translate-x-1/2 mt-1"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-slate-500 uppercase">Role Type</label>
                                <Input disabled={disabled} value={role.roleType || ''} onChange={e => updateRole(i, 'roleType', e.target.value)} className="h-8 text-xs bg-white" placeholder="e.g. director, psc" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-slate-500 uppercase">Role Title</label>
                                <Input disabled={disabled} value={role.roleTitle || ''} onChange={e => updateRole(i, 'roleTitle', e.target.value)} className="h-8 text-xs bg-white" placeholder="e.g. CEO" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-slate-500 uppercase">Appointed On</label>
                                <Input type="date" disabled={disabled} value={role.appointedOn || ''} onChange={e => updateRole(i, 'appointedOn', e.target.value)} className="h-8 text-xs bg-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-slate-500 uppercase">Resigned On</label>
                                <Input type="date" disabled={disabled} value={role.resignedOn || ''} onChange={e => updateRole(i, 'resignedOn', e.target.value)} className="h-8 text-xs bg-white" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-slate-100/50 p-2 rounded text-xs border border-slate-200/50">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <Checkbox 
                                    disabled={disabled}
                                    checked={role.isActiveRole ?? true} 
                                    onCheckedChange={v => updateRole(i, 'isActiveRole', v === true)} 
                                />
                                <span className="font-semibold text-slate-600 uppercase text-[10px]">Active Role</span>
                            </label>
                            
                            {role.company && (
                                <div className="text-slate-500 flex items-center gap-2">
                                    <span className="font-semibold text-[10px] uppercase">Company:</span>
                                    <span className="font-medium bg-slate-200/50 px-2 py-0.5 rounded text-slate-700">
                                        {role.company.name || role.company.externalId || "Unknown"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {(!value.roles || value.roles.length === 0) && (
                    <div className="text-xs text-slate-400 italic pl-3">No roles assigned.</div>
                )}
            </div>

            {/* Source Identifiers (Read-only) */}
            {safeValue.sourceIdentifiers && safeValue.sourceIdentifiers.length > 0 && (
                <div className="space-y-1.5 border-t border-slate-200 pt-3">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Source Identifiers</span>
                    <div className="flex flex-wrap gap-2">
                        {safeValue.sourceIdentifiers.map((si, i) => (
                            <span key={i} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                                <span className="font-mono mr-1 text-[10px] opacity-70">{si.scheme}:</span>
                                <span>{si.value}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
