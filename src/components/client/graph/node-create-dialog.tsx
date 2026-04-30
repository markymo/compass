"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function NodeCreateDialog({ open, onOpenChange, clientLEId, nodeType, initialData, entityId, onSuccess }: NodeCreateDialogProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});

    const isEditing = !!entityId;

    useEffect(() => {
        if (open && initialData) {
            // Map initialData to formData based on nodeType
            const mapped: Record<string, string> = {};
            if (nodeType === "PERSON") {
                mapped.firstName = initialData.firstName || "";
                mapped.lastName = initialData.lastName || "";
                mapped.nationality = initialData.primaryNationality || "";
            } else if (nodeType === "LEGAL_ENTITY") {
                mapped.entityName = initialData.name || "";
                mapped.registrationNumber = initialData.localRegistrationNumber || "";
            } else if (nodeType === "ADDRESS") {
                mapped.line1 = initialData.line1 || "";
                mapped.city = initialData.city || "";
                mapped.country = initialData.country || "";
            }
            setFormData(mapped);
        } else if (open) {
            setFormData({});
        }
    }, [open, initialData, nodeType]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let res;
            if (isEditing) {
                res = await updateGraphNodeAction({
                    clientLEId,
                    nodeType,
                    entityId: entityId!,
                    ...formData
                });
            } else {
                res = await createGraphNodeAction({
                    clientLEId,
                    nodeType,
                    ...formData
                });
            }

            if (res.success) {
                toast.success(`${isEditing ? 'Updated' : 'Created new'} ${nodeType.toLowerCase().replace('_', ' ')}`);
                
                let displayLabel = "Item";
                if (nodeType === 'PERSON') displayLabel = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || "Person";
                else if (nodeType === 'LEGAL_ENTITY') displayLabel = formData.entityName || "Entity";
                else if (nodeType === 'ADDRESS') displayLabel = formData.line1 || "Address";

                onSuccess(isEditing ? "" : (res as any).nodeId!, isEditing ? entityId! : (res as any).entityId!, displayLabel);
                onOpenChange(false);
                setFormData({});
            } else {
                toast.error((res as any).error || `Failed to ${isEditing ? 'update' : 'create'} node`);
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const renderFields = () => {
        if (nodeType === "PERSON") {
            return (
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input 
                                placeholder="John" 
                                value={formData.firstName || ""} 
                                onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input 
                                placeholder="Doe" 
                                value={formData.lastName || ""} 
                                onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Nationality</Label>
                        <Input 
                            placeholder="British" 
                            value={formData.nationality || ""} 
                            onChange={e => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                        />
                    </div>
                </div>
            );
        }

        if (nodeType === "LEGAL_ENTITY") {
            return (
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Entity Name</Label>
                        <Input 
                            placeholder="Acme Corp Ltd" 
                            value={formData.entityName || ""} 
                            onChange={e => setFormData(prev => ({ ...prev, entityName: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Registration Number</Label>
                        <Input 
                            placeholder="12345678" 
                            value={formData.registrationNumber || ""} 
                            onChange={e => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                        />
                    </div>
                </div>
            );
        }

        if (nodeType === "ADDRESS") {
            return (
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Address Line 1</Label>
                        <Input 
                            placeholder="100 Baker Street" 
                            value={formData.line1 || ""} 
                            onChange={e => setFormData(prev => ({ ...prev, line1: e.target.value }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>City</Label>
                            <Input 
                                placeholder="London" 
                                value={formData.city || ""} 
                                onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Country</Label>
                            <Input 
                                placeholder="United Kingdom" 
                                value={formData.country || ""} 
                                onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit' : 'Create New'} {nodeType.toLowerCase().replace('_', ' ')}</DialogTitle>
                    <DialogDescription>
                        {isEditing 
                            ? `Update the details for this ${nodeType.toLowerCase()}. Changes will reflect across all fields linked to this node.`
                            : `Enter the details for the new graph node. This will be available for all fields in this workspace.`
                        }
                    </DialogDescription>
                </DialogHeader>
                
                {renderFields()}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isEditing ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        {isEditing ? 'Save Changes' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
