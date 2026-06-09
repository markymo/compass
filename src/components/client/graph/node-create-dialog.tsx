"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Save } from "lucide-react";
import { createGraphNodeAction, updateGraphNodeAction } from "@/actions/graph-node-create";
import { toast } from "sonner";

interface NodeCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientLEId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    initialData?: Record<string, any> | null;
    entityId?: string | null;
    onSuccess: (nodeId: string, entityId: string, displayLabel: string) => void;
}

// ── Shared field component ─────────────────────────────────────────────────────

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {children}
        </div>
    );
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <Input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-8 text-sm"
        />
    );
}

// ── Form field state types ─────────────────────────────────────────────────────

interface PersonForm {
    title:              string;
    firstName:          string;
    lastName:           string;
    middleName:         string;
    dateOfBirth:        string;
    placeOfBirth:       string;
    nationality:        string;
    officerRole:        string;
    occupation:         string;
    countryOfResidence: string;
    isPublicFigure:     boolean;
}

interface LeForm {
    entityName:             string;
    registrationNumber:     string;
    jurisdiction:           string;
    legalForm:              string;
    entityStatus:           string;
    countryOfIncorporation: string;
}

interface AddressForm {
    line1:      string;
    line2:      string;
    city:       string;
    region:     string;
    postalCode: string;
    country:    string;
}

const emptyPerson   = (): PersonForm  => ({ title: "", firstName: "", lastName: "", middleName: "", dateOfBirth: "", placeOfBirth: "", nationality: "", officerRole: "", occupation: "", countryOfResidence: "", isPublicFigure: false });
const emptyLe       = (): LeForm      => ({ entityName: "", registrationNumber: "", jurisdiction: "", legalForm: "", entityStatus: "", countryOfIncorporation: "" });
const emptyAddress  = (): AddressForm => ({ line1: "", line2: "", city: "", region: "", postalCode: "", country: "" });

// ── Dialog ─────────────────────────────────────────────────────────────────────

export function NodeCreateDialog({ open, onOpenChange, clientLEId, nodeType, initialData, entityId, onSuccess }: NodeCreateDialogProps) {
    const [isSaving, setIsSaving] = useState(false);

    const [person,  setPerson]  = useState<PersonForm>(emptyPerson());
    const [le,      setLe]      = useState<LeForm>(emptyLe());
    const [address, setAddress] = useState<AddressForm>(emptyAddress());

    const isEditing = !!entityId;

    // Populate form when dialog opens or initial data changes
    useEffect(() => {
        if (!open) return;

        if (initialData && nodeType === "PERSON") {
            setPerson({
                title:              initialData.title              || "",
                firstName:          initialData.firstName          || "",
                lastName:           initialData.lastName           || "",
                middleName:         initialData.middleName         || "",
                dateOfBirth:        initialData.dateOfBirth
                    ? new Date(initialData.dateOfBirth).toISOString().slice(0, 10)
                    : "",
                placeOfBirth:       initialData.placeOfBirth       || "",
                nationality:        initialData.primaryNationality || "",
                officerRole:        initialData.officerRole        || "",
                occupation:         initialData.occupation         || "",
                countryOfResidence: initialData.countryOfResidence || "",
                isPublicFigure:     initialData.isPublicFigure     ?? false,
            });
        } else if (initialData && nodeType === "LEGAL_ENTITY") {
            setLe({
                entityName:             initialData.name                    || "",
                registrationNumber:     initialData.localRegistrationNumber || "",
                jurisdiction:           initialData.jurisdiction            || "",
                legalForm:              initialData.legalForm               || "",
                entityStatus:           initialData.entityStatus            || "",
                countryOfIncorporation: initialData.countryOfIncorporation  || "",
            });
        } else if (initialData && nodeType === "ADDRESS") {
            setAddress({
                line1:      initialData.line1      || "",
                line2:      initialData.line2      || "",
                city:       initialData.city       || "",
                region:     initialData.region     || "",
                postalCode: initialData.postalCode || "",
                country:    initialData.country    || "",
            });
        } else {
            // New node — blank form
            setPerson(emptyPerson());
            setLe(emptyLe());
            setAddress(emptyAddress());
        }
    }, [open, initialData, nodeType]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let res;

            if (nodeType === "PERSON") {
                const payload = {
                    clientLEId, nodeType: "PERSON" as const, entityId: entityId || undefined,
                    ...person,
                    dateOfBirth: person.dateOfBirth || null,
                };
                res = isEditing
                    ? await updateGraphNodeAction({ ...payload, entityId: entityId! })
                    : await createGraphNodeAction(payload);
            } else if (nodeType === "LEGAL_ENTITY") {
                res = isEditing
                    ? await updateGraphNodeAction({ clientLEId, nodeType: "LEGAL_ENTITY", entityId: entityId!, ...le })
                    : await createGraphNodeAction({ clientLEId, nodeType: "LEGAL_ENTITY", ...le });
            } else {
                res = isEditing
                    ? await updateGraphNodeAction({ clientLEId, nodeType: "ADDRESS", entityId: entityId!, ...address })
                    : await createGraphNodeAction({ clientLEId, nodeType: "ADDRESS", ...address });
            }

            if (res.success) {
                toast.success(`${isEditing ? "Updated" : "Created"} ${nodeType.toLowerCase().replace("_", " ")}`);
                const label =
                    nodeType === "PERSON"       ? `${person.firstName} ${person.lastName}`.trim() || "Person" :
                    nodeType === "LEGAL_ENTITY" ? (le.entityName || "Entity") :
                                                  (address.line1 || "Address");
                onSuccess(
                    isEditing ? "" : (res as any).nodeId ?? "",
                    isEditing ? entityId! : (res as any).entityId ?? "",
                    label
                );
                onOpenChange(false);
            } else {
                toast.error((res as any).error || `Failed to ${isEditing ? "update" : "create"} node`);
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    // ── PERSON fields ──────────────────────────────────────────────────────────
    const personFields = (
        <div className="space-y-3 py-2">
            <div className="grid grid-cols-4 gap-3">
                <Field label="Title">
                    <TextInput value={person.title} onChange={v => setPerson(p => ({ ...p, title: v }))} placeholder="Mr / Ms" />
                </Field>
                <div className="col-span-3">
                    <Field label="First Name" required>
                        <TextInput value={person.firstName} onChange={v => setPerson(p => ({ ...p, firstName: v }))} placeholder="Jane" />
                    </Field>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Middle Name">
                    <TextInput value={person.middleName} onChange={v => setPerson(p => ({ ...p, middleName: v }))} placeholder="Elizabeth" />
                </Field>
                <Field label="Last Name" required>
                    <TextInput value={person.lastName} onChange={v => setPerson(p => ({ ...p, lastName: v }))} placeholder="Doe" />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Date of Birth">
                    <TextInput type="date" value={person.dateOfBirth} onChange={v => setPerson(p => ({ ...p, dateOfBirth: v }))} />
                </Field>
                <Field label="Place of Birth">
                    <TextInput value={person.placeOfBirth} onChange={v => setPerson(p => ({ ...p, placeOfBirth: v }))} placeholder="London, UK" />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Nationality">
                    <TextInput value={person.nationality} onChange={v => setPerson(p => ({ ...p, nationality: v }))} placeholder="British" />
                </Field>
                <Field label="Country of Residence">
                    <TextInput value={person.countryOfResidence} onChange={v => setPerson(p => ({ ...p, countryOfResidence: v }))} placeholder="United Kingdom" />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Officer Role">
                    <TextInput value={person.officerRole} onChange={v => setPerson(p => ({ ...p, officerRole: v }))} placeholder="director" />
                </Field>
                <Field label="Occupation">
                    <TextInput value={person.occupation} onChange={v => setPerson(p => ({ ...p, occupation: v }))} placeholder="Company Director" />
                </Field>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer pt-1 select-none">
                <Checkbox
                    checked={person.isPublicFigure}
                    onCheckedChange={v => setPerson(p => ({ ...p, isPublicFigure: v === true }))}
                />
                <span className="text-sm text-slate-700">Politically Exposed Person / Public Figure</span>
            </label>
        </div>
    );

    // ── LEGAL_ENTITY fields ────────────────────────────────────────────────────
    const leFields = (
        <div className="space-y-3 py-2">
            <Field label="Entity Name" required>
                <TextInput value={le.entityName} onChange={v => setLe(l => ({ ...l, entityName: v }))} placeholder="Acme Corp Ltd" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Registration Number">
                    <TextInput value={le.registrationNumber} onChange={v => setLe(l => ({ ...l, registrationNumber: v }))} placeholder="12345678" />
                </Field>
                <Field label="Jurisdiction">
                    <TextInput value={le.jurisdiction} onChange={v => setLe(l => ({ ...l, jurisdiction: v }))} placeholder="England and Wales" />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Legal Form">
                    <TextInput value={le.legalForm} onChange={v => setLe(l => ({ ...l, legalForm: v }))} placeholder="Private Limited Company" />
                </Field>
                <Field label="Entity Status">
                    <TextInput value={le.entityStatus} onChange={v => setLe(l => ({ ...l, entityStatus: v }))} placeholder="ACTIVE" />
                </Field>
            </div>
            <Field label="Country of Incorporation">
                <TextInput value={le.countryOfIncorporation} onChange={v => setLe(l => ({ ...l, countryOfIncorporation: v }))} placeholder="GB" />
            </Field>
        </div>
    );

    // ── ADDRESS fields ─────────────────────────────────────────────────────────
    const addressFields = (
        <div className="space-y-3 py-2">
            <Field label="Address Line 1" required>
                <TextInput value={address.line1} onChange={v => setAddress(a => ({ ...a, line1: v }))} placeholder="100 Baker Street" />
            </Field>
            <Field label="Address Line 2">
                <TextInput value={address.line2} onChange={v => setAddress(a => ({ ...a, line2: v }))} placeholder="Flat 3" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                    <TextInput value={address.city} onChange={v => setAddress(a => ({ ...a, city: v }))} placeholder="London" />
                </Field>
                <Field label="Region / County">
                    <TextInput value={address.region} onChange={v => setAddress(a => ({ ...a, region: v }))} placeholder="Greater London" />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Postal Code">
                    <TextInput value={address.postalCode} onChange={v => setAddress(a => ({ ...a, postalCode: v }))} placeholder="NW1 6XE" />
                </Field>
                <Field label="Country" required>
                    <TextInput value={address.country} onChange={v => setAddress(a => ({ ...a, country: v }))} placeholder="GB" />
                </Field>
            </div>
        </div>
    );

    const typLabel = nodeType.toLowerCase().replace("_", " ");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>
                        {isEditing ? "Edit" : "Create New"}{" "}
                        {typLabel.charAt(0).toUpperCase() + typLabel.slice(1)}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? `Update the details for this ${typLabel}. Changes will reflect across all fields linked to this node.`
                            : `Enter the details for the new graph node. This will be available for all fields in this workspace.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-1">
                    {nodeType === "PERSON"       && personFields}
                    {nodeType === "LEGAL_ENTITY" && leFields}
                    {nodeType === "ADDRESS"      && addressFields}
                </div>

                <DialogFooter className="shrink-0 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                        {isSaving
                            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            : isEditing
                                ? <Save className="h-4 w-4 mr-2" />
                                : <Plus className="h-4 w-4 mr-2" />}
                        {isEditing ? "Save Changes" : "Create"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
