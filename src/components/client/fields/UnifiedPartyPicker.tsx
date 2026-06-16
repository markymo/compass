"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, User, Building, Loader2 } from "lucide-react";
import { searchCCParties } from "@/actions/cc-party-actions";
import { addExistingCCPartyReferenceToField, createCCPartyAndReferenceField } from "@/actions/kyc-manual-update";
import { PersonOrContactValueEditor } from "./PersonOrContactValueEditor";
import { PartyValue } from "@/lib/master-data/party-value";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface UnifiedPartyPickerProps {
    clientLEId: string;
    fieldNo: number;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
    // For repeating fields, we might need a rowId, but usually 'add' creates a new row if undefined
    rowId?: string;
}

export function UnifiedPartyPicker({ clientLEId, fieldNo, trigger, onSuccess, rowId }: UnifiedPartyPickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, startSearchTransition] = useTransition();
    const [isSaving, startSaveTransition] = useTransition();

    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newPartyData, setNewPartyData] = useState<PartyValue | null>(null);

    // Reset state on open
    useEffect(() => {
        if (open) {
            setQuery("");
            setResults([]);
            setIsCreatingNew(false);
            setNewPartyData(null);
        }
    }, [open]);

    // Handle Search
    useEffect(() => {
        if (!open) return;
        
        startSearchTransition(async () => {
            try {
                const data = await searchCCParties(clientLEId, query);
                setResults(data);
            } catch (err) {
                console.error("Search failed", err);
            }
        });
    }, [query, clientLEId, open]);

    const handleSelectExisting = (party: any) => {
        startSaveTransition(async () => {
            try {
                const res = await addExistingCCPartyReferenceToField(clientLEId, fieldNo, party.id, rowId);
                if (res.success) {
                    toast.success("Party added successfully");
                    setOpen(false);
                    onSuccess?.();
                } else {
                    toast.error(res.message || "Failed to add party");
                }
            } catch (err: any) {
                toast.error(err.message || "An error occurred");
            }
        });
    };

    const handleCreateNew = () => {
        setIsCreatingNew(true);
        // Initialize default empty structure
        setNewPartyData({
            partyType: "INDIVIDUAL",
            contactType: "PERSON",
            roles: fieldNo === 63 ? [{
                roleType: "director",
                roleTitle: "Director",
                company: {
                    coparityCompanyId: null,
                    externalId: null,
                    externalIdScheme: null,
                    name: null
                },
                isActiveRole: true,
                appointedOn: null,
                resignedOn: null,
                natureOfControl: []
            }] : [],
            title: null,
            forenames: "",
            surname: "",
            email: null,
            phones: [],
            nationality: [],
            countryOfResidence: null,
            dateOfBirth: null,
            placeOfBirth: null,
            sourceIdentifiers: [],
            isActivePersonOrContact: null,
            visibility: { scope: "CLIENT_LE" }
        } as any);
    };

    const handleSaveNew = () => {
        if (!newPartyData) return;

        startSaveTransition(async () => {
            try {
                const res = await createCCPartyAndReferenceField(clientLEId, fieldNo, newPartyData, rowId);
                if (res.success) {
                    toast.success("New party created and added successfully");
                    setOpen(false);
                    onSuccess?.();
                } else {
                    toast.error(res.message || "Failed to create party");
                }
            } catch (err: any) {
                toast.error(err.message || "An error occurred");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        variant="outline"
                        className="w-full justify-center bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-700 border-dashed"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Party / Contact
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isCreatingNew ? "Create New Party" : "Select or Create Party"}</DialogTitle>
                </DialogHeader>

                {!isCreatingNew ? (
                    <div className="space-y-4 pt-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search existing curated parties..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
                            )}
                        </div>

                        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                            {results.length > 0 ? (
                                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                    {results.map((p) => {
                                        const name = p.data.partyType === 'ORGANISATION' ? p.data.name : 
                                            p.data.contactType === 'PERSON' ? `${p.data.forenames || ''} ${p.data.surname || ''}`.trim() : 
                                            p.data.partyType === 'INDIVIDUAL' ? `${p.data.forenames || ''} ${p.data.surname || ''}`.trim() : 'Unknown';
                                        
                                        return (
                                            <button
                                                key={p.id}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col gap-1 transition-colors group"
                                                onClick={() => handleSelectExisting(p)}
                                                disabled={isSaving}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2">
                                                        {p.data.partyType === 'ORGANISATION' ? <Building className="h-4 w-4 text-slate-400" /> : <User className="h-4 w-4 text-slate-400" />}
                                                        <span className="font-medium text-sm text-slate-700 group-hover:text-indigo-700">{name || 'Unnamed'}</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 font-normal">
                                                        {p.data.contactType || p.data.partyType || 'Party'}
                                                    </Badge>
                                                </div>
                                                {p.data.roles && p.data.roles.length > 0 && (
                                                    <div className="text-xs text-slate-500 flex items-center gap-2 pl-6">
                                                        <span>{p.data.roles.map((r: any) => r.roleTitle || r.roleType).join(', ')}</span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                                        <Search className="h-5 w-5" />
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {query ? "No matching parties found." : "Start typing to search curated parties."}
                                    </p>
                                </div>
                            )}
                            
                            <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                                <Button 
                                    variant="outline" 
                                    className="w-full bg-white shadow-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                    onClick={handleCreateNew}
                                    disabled={isSaving}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create new person / organisation
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pt-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <PersonOrContactValueEditor
                                value={newPartyData!}
                                onChange={(val) => setNewPartyData(val as any)}
                                disabled={isSaving}
                                fieldNo={fieldNo}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-4">
                            <Button
                                variant="ghost"
                                onClick={() => setIsCreatingNew(false)}
                                disabled={isSaving}
                            >
                                Back to search
                            </Button>
                            <Button
                                onClick={handleSaveNew}
                                disabled={isSaving || !newPartyData}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save & Select
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
