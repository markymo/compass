"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateMasterField } from "@/actions/master-data-governance";

interface FieldEditDialogProps {
    field: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FieldEditDialog({ field, open, onOpenChange }: FieldEditDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fieldName: field?.fieldName || "",
        category: field?.category || "",
        notes: field?.notes || ""
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await updateMasterField(field.fieldNo, formData);
            if (res.success) {
                toast.success("Field updated successfully");
                onOpenChange(false);
            } else {
                toast.error(res.error || "Failed to update field");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Master Field #{field?.fieldNo}</DialogTitle>
                    <DialogDescription>
                        Update core metadata for this canonical data point.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="fieldName">Field Name</Label>
                        <Input
                            id="fieldName"
                            value={formData.fieldName}
                            onChange={(e) => setFormData({ ...formData, fieldName: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="category">Category</Label>
                        <Input
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Description / Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Explain the purpose of this field..."
                            className="h-32"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
