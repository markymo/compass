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
import { AlertCircle } from "lucide-react";
import { ClientLETeamAccess } from "./client-le-team-access";

export function CreateLEDialog({ orgId }: { orgId?: string }) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    const [step, setStep] = useState<"create" | "access">("create");
    const [createdLE, setCreatedLE] = useState<{ id: string; name: string } | null>(null);

    const [name, setName] = useState("");
    const [jurisdiction, setJurisdiction] = useState("");
    const [lei, setLei] = useState("");
    const [gleifData, setGleifData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <Button>Add Legal Entity</Button>;

    function handleOpenChange(newOpen: boolean) {
        setOpen(newOpen);
        if (!newOpen) {
            // Reset modal state when closed
            setStep("create");
            setCreatedLE(null);
            setName("");
            setJurisdiction("");
            setLei("");
            setGleifData(null);
            setActionError(null);
            router.refresh();
        }
    }

    async function handleCreate() {
        if (!name || !jurisdiction) return;
        setLoading(true);
        setActionError(null);
        try {
            const res = await createClientLE({
                name,
                jurisdiction,
                explicitOrgId: orgId,
                lei: lei || undefined,
                gleifData: gleifData || undefined
            });

            if (res.success && res.data) {
                const leId = res.data.id;
                const leName = res.data.name || name;

                setCreatedLE({ id: leId, name: leName });
                setStep("access");

                if (res.message) {
                    toast.info(res.message);
                } else {
                    toast.success(`Legal Entity "${leName}" created`);
                }
            } else {
                setActionError(res.error || "Failed to create entity");
            }
        } catch (error) {
            setActionError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }

    function handleFinishedSetup() {
        setOpen(false);
        setStep("create");
        setCreatedLE(null);
        setName("");
        setJurisdiction("");
        setLei("");
        setGleifData(null);
        setActionError(null);
        router.refresh();
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>Add Legal Entity</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-w-[95vw] rounded-2xl p-6">
                <DialogHeader className={step === "access" ? "sr-only" : ""}>
                    <DialogTitle>Add New Legal Entity</DialogTitle>
                    <DialogDescription>Create a managed entity to start inputting data.</DialogDescription>
                </DialogHeader>

                {step === "create" ? (
                    <div className="space-y-4 py-2">
                        {actionError && (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-start gap-3 text-sm">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-red-900 mb-0.5">Unable to add entity</p>
                                    <p>{actionError}</p>
                                </div>
                            </div>
                        )}
                        <LEILookup
                            onDataFetched={(data, summary) => {
                                setName(summary.name);
                                setJurisdiction(summary.jurisdiction);
                                setGleifData(data);
                                if (data.id) setLei(data.id);
                            }}
                        />

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
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Acme Corp Ltd"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Jurisdiction</Label>
                            <Input
                                value={jurisdiction}
                                onChange={(e) => setJurisdiction(e.target.value)}
                                placeholder="e.g. UK, Delaware, Singapore"
                            />
                        </div>
                        <Button onClick={handleCreate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                            {loading ? "Creating..." : "Create Legal Entity"}
                        </Button>
                    </div>
                ) : (
                    createdLE && (
                        <ClientLETeamAccess
                            clientLEId={createdLE.id}
                            clientLEName={createdLE.name}
                            orgId={orgId || ""}
                            isInitialSetup={true}
                            onSuccess={handleFinishedSetup}
                            onCancel={handleFinishedSetup}
                        />
                    )
                )}
            </DialogContent>
        </Dialog>
    );
}
