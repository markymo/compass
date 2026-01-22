"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { assignClientRole, assignLERole } from "@/actions/super-admin-users";
import { Loader2, ShieldAlert, Building2, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserPermissionsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    user: any; // The user object from getClientUsers
    clientName: string;
    clientId: string;
    les: { id: string, name: string }[];
    onUpdate: () => void;
}

export function UserPermissionsSheet({ isOpen, onClose, user, clientName, clientId, les, onUpdate }: UserPermissionsSheetProps) {
    const [loading, setLoading] = useState(false);

    // Local state for optimistic UI updates could go here, but for simplicity we rely on Actions + Toast
    // Actually, distinct handlers for each change is better for "God Mode" feel - immediate save.

    if (!user) return null;

    async function handleClientRoleChange(role: string) {
        setLoading(true);
        const res = await assignClientRole({ userId: user.user.id, clientId, role });
        setLoading(false);

        if (res.success) {
            toast.success("Client Role Updated");
            onUpdate(); // Refresh parent data
        } else {
            toast.error("Failed to update role");
        }
    }

    async function handleLERoleChange(leId: string, role: string) {
        // Optimistic / Silent update? Let's show spinner on the specific row if precise, or global for now.
        // Doing global loading for safety.
        setLoading(true);
        const res = await assignLERole({ userId: user.user.id, leId, role });
        setLoading(false);

        if (res.success) {
            toast.success("Access Updated");
            onUpdate();
        } else {
            toast.error("Failed to update access");
        }
    }

    // Checking effective permissions for warnings
    const isClientAdmin = user.clientRole === "ADMIN";

    return (
        <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full">
                <SheetHeader>
                    <SheetTitle>Edit Permissions</SheetTitle>
                    <SheetDescription>
                        Managing access for <span className="font-semibold text-foreground">{user.user.email}</span>
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 py-6">

                    {/* SECTION 1: BUILDING PASS */}
                    <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-700">Client Access (Building)</h3>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right col-span-1">Role</Label>
                            <Select
                                value={user.clientRole || "NONE"}
                                onValueChange={handleClientRoleChange}
                                disabled={loading}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">No Direct Access</SelectItem>
                                    <SelectItem value="MEMBER">Member (Lobby)</SelectItem>
                                    <SelectItem value="ADMIN">Admin (Keymaster)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    {/* SECTION 2: ROOM KEYS */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Briefcase className="w-4 h-4 text-slate-500" />
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-700">Legal Entity Access (Rooms)</h3>
                        </div>

                        <ScrollArea className="flex-1 border rounded-lg p-2">
                            <div className="space-y-1">
                                {les.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        No Legal Entities found for this client.
                                    </div>
                                ) : (
                                    les.map(le => {
                                        const currentRole = user.leRoles[le.id] || "NONE";
                                        // Effect of Admin?
                                        // If Admin, they see it, but don't have "Enter" unless they have a role.
                                        // So we should encourage giving them a role if they need to work on it.

                                        return (
                                            <div key={le.id} className="flex items-center justify-between p-2 hover:bg-slate-100 rounded-md transition-colors">
                                                <div className="flex flex-col flex-1 mr-4 min-w-0">
                                                    <span className="font-medium text-sm truncate">{le.name}</span>
                                                    {isClientAdmin && currentRole === "NONE" && (
                                                        <span className="text-[10px] text-amber-600 flex items-center gap-1">
                                                            Management Only (Cannot Enter)
                                                        </span>
                                                    )}
                                                </div>
                                                <Select
                                                    value={currentRole}
                                                    onValueChange={(val) => handleLERoleChange(le.id, val)}
                                                    disabled={loading}
                                                >
                                                    <SelectTrigger className="w-[130px] h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="NONE">No Access</SelectItem>
                                                        <SelectItem value="VIEWER">Viewer</SelectItem>
                                                        <SelectItem value="EDITOR">Editor</SelectItem>
                                                        {/* Optional: LE Admin? For now just Editor/Viewer map to Member */}
                                                        {/* Our backend only stores role string. "Member" usually implies edit effectively in current simplistic model. */}
                                                        <SelectItem value="MEMBER">Member</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <SheetFooter>
                    {/* Could add a 'Close' button or just click outside */}
                </SheetFooter>

                {loading && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
