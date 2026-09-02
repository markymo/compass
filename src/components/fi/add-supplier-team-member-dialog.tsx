"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, UserPlus, Link as LinkIcon, Check, Copy, Building2, Shield } from "lucide-react";
import { inviteSupplier } from "@/actions/supplier-invitations";
import { useRouter } from "next/navigation";

interface AddSupplierTeamMemberDialogProps {
    orgName: string;
    manageableRelationships: { id: string; clientLEName: string }[];
}

export function AddSupplierTeamMemberDialog({ orgName, manageableRelationships }: AddSupplierTeamMemberDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'FORM' | 'SUCCESS'>('FORM');
    const [isLoading, setIsLoading] = useState(false);

    // Form state
    const [selectedRelId, setSelectedRelId] = useState<string>(
        manageableRelationships.length === 1 ? manageableRelationships[0].id : ""
    );
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<'RELATIONSHIP_ADMIN' | 'RELATIONSHIP_USER'>('RELATIONSHIP_USER');
    const [message, setMessage] = useState("");

    // Success state
    const [inviteLink, setInviteLink] = useState("");
    const [emailSent, setEmailSent] = useState(false);

    const handleAdd = async () => {
        if (!selectedRelId) {
            toast.error("Please select a target Relationship");
            return;
        }
        if (!email) {
            toast.error("Please enter an email address");
            return;
        }

        setIsLoading(true);
        try {
            const result = await inviteSupplier(selectedRelId, email, role, message);

            if (result.success) {
                if (result.autoAdded) {
                    toast.success("User already has an OnPro account. Relationship access granted immediately.");
                    handleClose();
                    router.refresh();
                    return;
                }
                if (result.token) {
                    const link = `${window.location.origin}/invite/${result.token}`;
                    setInviteLink(link);
                    setEmailSent(Boolean(result.emailSent));
                    setStep('SUCCESS');
                    toast.success("Invitation created");
                    router.refresh();
                }
            } else {
                toast.error(result.error || "Failed to add team member");
            }
        } catch (e: any) {
            toast.error(e?.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.success("Link copied to clipboard");
    };

    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            setStep('FORM');
            setSelectedRelId(manageableRelationships.length === 1 ? manageableRelationships[0].id : "");
            setEmail("");
            setRole('RELATIONSHIP_USER');
            setMessage("");
            setInviteLink("");
            setEmailSent(false);
        }, 300);
    };

    if (manageableRelationships.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => (val ? setOpen(true) : handleClose())}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs h-9 px-3.5 gap-1.5 shadow-sm">
                    <UserPlus className="h-4 w-4" />
                    Add Team Member
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Add Relationship Team Member</DialogTitle>
                    <DialogDescription>
                        Assign an existing user or invite a new collaborator to a Client Legal Entity Relationship.
                    </DialogDescription>
                </DialogHeader>

                {step === 'FORM' && (
                    <div className="space-y-4 py-3">
                        {/* Target Relationship Selector */}
                        <div className="space-y-1.5">
                            <Label htmlFor="relationship-select">Target Relationship *</Label>
                            {manageableRelationships.length === 1 ? (
                                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-teal-600" />
                                    {manageableRelationships[0].clientLEName}
                                </div>
                            ) : (
                                <select
                                    id="relationship-select"
                                    value={selectedRelId}
                                    onChange={(e) => setSelectedRelId(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 text-slate-800"
                                >
                                    <option value="">Select target relationship...</option>
                                    {manageableRelationships.map((rel) => (
                                        <option key={rel.id} value={rel.id}>
                                            {rel.clientLEName}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Email Input */}
                        <div className="space-y-1.5">
                            <Label htmlFor="team-member-email">Collaborator Email *</Label>
                            <Input
                                id="team-member-email"
                                type="email"
                                placeholder="colleague@bank.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-9 text-xs"
                            />
                            <p className="text-[11px] text-slate-400">
                                Existing OnPro users receive access immediately without token registration.
                            </p>
                        </div>

                        {/* Role Selector */}
                        <div className="space-y-1.5">
                            <Label htmlFor="team-member-role">Relationship Role *</Label>
                            <select
                                id="team-member-role"
                                value={role}
                                onChange={(e) => setRole(e.target.value as any)}
                                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 text-slate-800"
                            >
                                <option value="RELATIONSHIP_USER">Relationship User (Answer questionnaires, view relationships)</option>
                                <option value="RELATIONSHIP_ADMIN">Relationship Admin (Manage team members and questionnaires)</option>
                            </select>
                        </div>

                        {/* Message Input */}
                        <div className="space-y-1.5">
                            <Label htmlFor="team-member-message">Personal Note (Optional)</Label>
                            <Textarea
                                id="team-member-message"
                                placeholder="I've added you to collaborate on questionnaires for this relationship."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="text-xs min-h-[60px]"
                            />
                        </div>
                    </div>
                )}

                {step === 'SUCCESS' && (
                    <div className="py-4 space-y-4">
                        <div className="flex items-center gap-3 text-teal-800 bg-teal-50 p-4 rounded-xl border border-teal-100">
                            <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                                <Check className="h-4 w-4 text-teal-700" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-teal-900">Invitation Created</h4>
                                <p className="text-xs text-teal-700 mt-0.5">
                                    {emailSent
                                        ? "An invitation has been dispatched to the recipient."
                                        : "Share the link below with your colleague to complete access setup."}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Invitation Link</Label>
                            <div className="flex gap-2">
                                <Input value={inviteLink} readOnly className="font-mono text-xs bg-slate-50 h-9" />
                                <Button variant="secondary" size="icon" onClick={copyLink} className="h-9 w-9 shrink-0">
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Copy and deliver this link to the recipient if email delivery is delayed.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'FORM' ? (
                        <>
                            <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs">Cancel</Button>
                            <Button
                                size="sm"
                                onClick={handleAdd}
                                disabled={isLoading || !selectedRelId || !email}
                                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
                            >
                                {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                Add Collaborator
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" onClick={handleClose} className="bg-teal-700 hover:bg-teal-800 text-white text-xs">
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
