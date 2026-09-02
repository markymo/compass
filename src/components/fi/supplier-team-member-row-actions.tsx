"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MoreHorizontal, Shield, UserMinus, Loader2 } from "lucide-react";
import { updateMembershipRole, removeMembership } from "@/actions/memberships";

interface RelationshipEntry {
    id: string;
    clientLEName: string;
    membershipId?: string;
    role?: string;
}

interface SupplierTeamMemberRowActionsProps {
    member: {
        userId: string;
        membershipId?: string;
        name: string | null;
        email: string;
        role: string;
        accessScope: {
            kind: "SUPPLIER" | "RELATIONSHIPS";
            relationships?: RelationshipEntry[];
        };
    };
    canManage: boolean;
}

export function SupplierTeamMemberRowActions({ member, canManage }: SupplierTeamMemberRowActionsProps) {
    const router = useRouter();
    const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Identify target relationship membership to update or remove
    const rel = member.accessScope.relationships?.[0];
    const targetMembershipId = member.membershipId || rel?.membershipId;
    const currentRole = rel?.role || member.role;
    const [selectedRole, setSelectedRole] = useState<string>(currentRole);

    if (!canManage || !targetMembershipId) {
        return null;
    }

    const handleChangeRole = async () => {
        setIsLoading(true);
        try {
            const res = await updateMembershipRole(targetMembershipId, selectedRole);
            if (res.success) {
                toast.success("Role updated successfully");
                setIsChangeRoleOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to update role");
            }
        } catch (err: any) {
            toast.error(err?.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = async () => {
        setIsLoading(true);
        try {
            const res = await removeMembership(targetMembershipId);
            if (res.success) {
                toast.success("Relationship access removed");
                setIsRemoveOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Failed to remove membership");
            }
        } catch (err: any) {
            toast.error(err?.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-[11px] text-slate-500 font-semibold">
                        Manage Access
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            setSelectedRole(currentRole);
                            setIsChangeRoleOpen(true);
                        }}
                        className="text-xs cursor-pointer gap-2"
                    >
                        <Shield className="h-3.5 w-3.5 text-slate-500" />
                        Change Role
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setIsRemoveOpen(true)}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer gap-2"
                    >
                        <UserMinus className="h-3.5 w-3.5 text-rose-500" />
                        Remove Access
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Change Role Dialog */}
            <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Change Role</DialogTitle>
                        <DialogDescription>
                            Update the relationship access level for {member.name || member.email}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="change-role-select">Select Role</Label>
                            <select
                                id="change-role-select"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                            >
                                <option value="RELATIONSHIP_ADMIN">Relationship Admin</option>
                                <option value="RELATIONSHIP_USER">Relationship User</option>
                            </select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setIsChangeRoleOpen(false)} className="text-xs">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleChangeRole}
                            disabled={isLoading}
                            className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
                        >
                            {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Save Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Access Confirmation Dialog */}
            <Dialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600">Remove Relationship Access</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove {member.name || member.email} from this Relationship?
                            Other organisation and client memberships will remain unaffected.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setIsRemoveOpen(false)} className="text-xs">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleRemove}
                            disabled={isLoading}
                            className="text-xs"
                        >
                            {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Confirm Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
