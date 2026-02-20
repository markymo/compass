"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientLE } from "@/actions/client";
import { useRouter } from "next/navigation";
import { LEILookup } from "./lei-lookup";
import { toast } from "sonner";

export function CreateLEDialog({ orgId }: { orgId?: string }) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    const [name, setName] = useState("");
    const [jurisdiction, setJurisdiction] = useState("");
    const [lei, setLei] = useState("");
    const [gleifData, setGleifData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <Button>Add Legal Entity</Button>; // Show skeleton/static button during SSR to match

    async function handleCreate() {
        if (!name || !jurisdiction) return;
        setLoading(true);
        try {
            const res = await createClientLE({
                name,
                jurisdiction,
                explicitOrgId: orgId,
                lei: lei || undefined,
                gleifData: gleifData || undefined
            });

            if (res.success) {
                setOpen(false);
                setName("");
                setJurisdiction("");
                setLei("");
                setGleifData(null);

                if (res.message) {
                    toast.info(res.message); // Informational toast for linking
                } else {
                    toast.success("Legal Entity created successfully");
                }

                router.refresh();
            } else {
                toast.error(res.error || "Failed to create entity");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Add Legal Entity</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl">
                <DialogHeader>
                    <DialogTitle>Add New Legal Entity</DialogTitle>
                    <DialogDescription>Create a managed entity to start inputting data.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <LEILookup onDataFetched={(data, summary) => {
                        setName(summary.name);
                        setJurisdiction(summary.jurisdiction);
                        setGleifData(data);
                        setLei(data.id); // Or extract from attributes if needed, but data.id is the LEI in GLEIF JSON usually? No, the ID in the list is the LEI.
                        // Actually in my gleif.ts, data is the record object. record.id is the LEI? 
                        // Looking at gleif.ts: `const record = json.data[0];`
                        // GLEIF JSON: data: [{ id: "LEI...", type: "lei-records", attributes: { lei: "LEI..." } }]
                        // So data.id is the LEI.
                        // However, I should setLei explicitly to what the user typed OR what comes back.
                        // Let's use the one from the record to be safe.
                        if (data.id) setLei(data.id);
                    }} />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or Enter Manually</span>
                        </div>
                    </div>

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
