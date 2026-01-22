"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientLE } from "@/actions/client";
import { useRouter } from "next/navigation";

export function CreateLEDialog({ orgId }: { orgId?: string }) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    const [name, setName] = useState("");
    const [jurisdiction, setJurisdiction] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <Button>Add Legal Entity</Button>; // Show skeleton/static button during SSR to match

    async function handleCreate() {
        if (!name || !jurisdiction) return;
        setLoading(true);
        // Pass the explicitOrgId if available
        const res = await createClientLE({ name, jurisdiction, explicitOrgId: orgId });
        setLoading(false);

        if (res.success) {
            setOpen(false);
            setName("");
            setJurisdiction("");
            router.refresh();
        } else {
            alert("Error creating entity");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Add Legal Entity</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Legal Entity</DialogTitle>
                    <DialogDescription>Create a managed entity to start inputting data.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Entity Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp Ltd" />
                    </div>
                    <div className="space-y-2">
                        <Label>Jurisdiction</Label>
                        <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. UK, Delaware, Singapore" />
                    </div>
                    <Button onClick={handleCreate} disabled={loading} className="w-full">Create Entity</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
