"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { ClientLETeamAccess } from "./client-le-team-access";

interface ManageLETeamDialogProps {
    clientLEId: string;
    clientLEName: string;
    orgId: string;
    trigger?: React.ReactNode;
}

export function ManageLETeamDialog({
    clientLEId,
    clientLEName,
    orgId,
    trigger
}: ManageLETeamDialogProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-slate-200">
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        Manage team
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-w-[95vw] rounded-2xl p-6">
                <DialogHeader className="sr-only">
                    <DialogTitle>Manage Team Access for {clientLEName}</DialogTitle>
                    <DialogDescription>Assign LE Admin or LE User permissions for this Legal Entity.</DialogDescription>
                </DialogHeader>

                <ClientLETeamAccess
                    clientLEId={clientLEId}
                    clientLEName={clientLEName}
                    orgId={orgId}
                    isInitialSetup={false}
                    onSuccess={() => setOpen(false)}
                    onCancel={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
