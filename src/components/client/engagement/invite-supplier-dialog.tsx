"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Mail, Link as LinkIcon, Check, Copy } from "lucide-react";
import { inviteSupplier } from "@/actions/supplier-invitations";

interface InviteSupplierDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    engagementId: string;
    orgName: string;
}

export function InviteSupplierDialog({ open, onOpenChange, engagementId, orgName }: InviteSupplierDialogProps) {
    const [step, setStep] = useState<'FORM' | 'SUCCESS'>('FORM');
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    // Success State
    const [inviteLink, setInviteLink] = useState("");

    const handleInvite = async () => {
        if (!email) {
            toast.error("Please enter an email address");
            return;
        }

        setIsLoading(true);
        try {
            const result = await inviteSupplier(engagementId, email, "Supplier Contact", message);

            if (result.success && result.token) {
                const link = `${window.location.origin}/invite/${result.token}`;
                setInviteLink(link);
                setStep('SUCCESS');
                toast.success("Invitation created");
            } else {
                toast.error(result.error || "Failed to create invitation");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.success("Link copied to clipboard");
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset state after close animation
        setTimeout(() => {
            setStep('FORM');
            setEmail("");
            setMessage("");
            setInviteLink("");
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Invite {orgName}</DialogTitle>
                    <DialogDescription>
                        Invite a representative from {orgName} to collaborate on this engagement.
                    </DialogDescription>
                </DialogHeader>

                {step === 'FORM' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Supplier Email</Label>
                            <Input
                                id="email"
                                placeholder="name@bank.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="message">Personal Message (Optional)</Label>
                            <Textarea
                                id="message"
                                placeholder={`Hi, I'm inviting you to collaborate on our onboarding via Compass...`}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                            <strong>Note:</strong> This will grant the user access to shared documents and questionnaires.
                        </div>
                    </div>
                )}

                {step === 'SUCCESS' && (
                    <div className="py-6 space-y-4">
                        <div className="flex items-center gap-3 text-green-600 bg-green-50 p-4 rounded-lg border border-green-100">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                <Check className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold">Invitation Created!</h4>
                                <p className="text-sm text-green-700">The supplier has been invited.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Invitation Link</Label>
                            <div className="flex gap-2">
                                <Input value={inviteLink} readOnly className="font-mono text-sm bg-slate-50" />
                                <Button variant="secondary" size="icon" onClick={copyLink}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Share this link manually if the email notification is delayed.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'FORM' ? (
                        <>
                            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button onClick={handleInvite} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Send Invitation
                            </Button>
                        </>
                    ) : (
                        <Button onClick={handleClose}>Done</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
