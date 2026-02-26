"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createMasterFieldGroup, updateMasterFieldGroup } from "@/actions/master-data-governance";

interface GroupEditDialogProps {
    group?: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GroupEditDialog({ group, open, onOpenChange }: GroupEditDialogProps) {
    const isEditing = !!group;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        key: "",
        label: "",
        category: "",
        description: "",
        order: 0
    });

    useEffect(() => {
        if (group) {
            setFormData({
                key: group.key || "",
                label: group.label || "",
                category: group.category || "",
                description: group.description || "",
                order: group.order || 0
            });
        } else {
            setFormData({
                key: "",
                label: "",
                category: "",
                description: "",
                order: 0
            });
        }
    }, [group, open]);

    const handleSave = async () => {
        if (!formData.key || !formData.label) {
            toast.error("Group Key and Label are required");
            return;
        }

        setLoading(true);
        try {
            let res;
            if (isEditing) {
                res = await updateMasterFieldGroup(group.id, formData);
            } else {
                res = await createMasterFieldGroup(formData);
            }

            if (res.success) {
                toast.success(isEditing ? "Group updated successfully" : "Group created successfully");
                onOpenChange(false);
            } else {
                toast.error(res.error || "Failed to save group");
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
                    <DialogTitle>{isEditing ? `Edit Group: ${group.label}` : "Create New Group"}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? "Update metadata for this virtual container." : "Define a new logic-only container for fields."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="key">Group Unique Key</Label>
                        <Input
                            id="key"
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                            placeholder="e.g. GROUP_IDENTITY_DOCS"
                            disabled={isEditing}
                        />
                        {!isEditing && <p className="text-[10px] text-slate-500 uppercase">Uppercase, no spaces. Use underscores.</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="label">Display Label</Label>
                        <Input
                            id="label"
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            placeholder="e.g. Identity Documents"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="category">Category</Label>
                        <Input
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            placeholder="e.g. Identity"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="order">Display Order</Label>
                        <Input
                            id="order"
                            type="number"
                            value={formData.order}
                            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description / Helper Text</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Explain the purpose of this group for other admins..."
                            className="h-24"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Save Changes" : "Create Group"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
