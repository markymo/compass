"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Plus, Building2, FileText } from "lucide-react";
import { searchFinancialInstitutions, getAvailableQuestionnaires, addRequirement } from "@/actions/requirements";
import { toast } from "sonner"; // Or alert if sonner not available yet
import { useRouter } from "next/navigation";

// Types matching action output
type FIResult = { id: string; name: string; _count: { questionnaires: number } };
type QuestionnaireResult = { id: string; name: string };

export function RequirementSearch({ clientLEId }: { clientLEId: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"SEARCH" | "SELECT_FORMS">("SEARCH");

    // Search State
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<FIResult[]>([]);
    const [searching, setSearching] = useState(false);

    // Selection State
    const [selectedFI, setSelectedFI] = useState<FIResult | null>(null);
    const [availableForms, setAvailableForms] = useState<QuestionnaireResult[]>([]);
    const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
    const [loadingForms, setLoadingForms] = useState(false);
    const [saving, setSaving] = useState(false);

    async function handleSearch() {
        if (query.length < 2) return;
        setSearching(true);
        const res = await searchFinancialInstitutions(query);
        setResults(res);
        setSearching(false);
    }

    async function handleSelectFI(fi: FIResult) {
        setSelectedFI(fi);
        setLoadingForms(true);
        setStep("SELECT_FORMS");

        const forms = await getAvailableQuestionnaires(fi.id);
        setAvailableForms(forms);
        setLoadingForms(false);
    }

    function toggleForm(id: string) {
        setSelectedFormIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }

    async function handleAdd() {
        if (!selectedFI || selectedFormIds.length === 0) return;
        setSaving(true);
        const res = await addRequirement(clientLEId, selectedFI.id, selectedFormIds);
        setSaving(false);

        if (res.success) {
            setOpen(false);
            setStep("SEARCH");
            setQuery("");
            setResults([]);
            setSelectedFI(null);
            setSelectedFormIds([]);
            router.refresh();
        } else {
            alert("Failed to add requirements");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Requirement
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Requirements</DialogTitle>
                    <DialogDescription>
                        Search for a Financial Institution to add their questionnaires to your list.
                    </DialogDescription>
                </DialogHeader>

                {step === "SEARCH" && (
                    <div className="space-y-4 py-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Search Bank, Insurer..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                            <Button onClick={handleSearch} disabled={searching} variant="secondary">
                                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </Button>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {results.length > 0 ? (
                                results.map(fi => (
                                    <div
                                        key={fi.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                                        onClick={() => handleSelectFI(fi)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{fi.name}</div>
                                                <div className="text-xs text-muted-foreground">{fi._count.questionnaires} Active Forms</div>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost">Select</Button>
                                    </div>
                                ))
                            ) : (
                                query.length > 2 && !searching && <div className="text-center text-sm text-muted-foreground py-8">No institutions found.</div>
                            )}
                        </div>
                    </div>
                )}

                {step === "SELECT_FORMS" && selectedFI && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                            <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" onClick={() => setStep("SEARCH")}>&larr; Back</Button>
                            <span>/</span>
                            <span className="font-medium text-foreground">{selectedFI.name}</span>
                        </div>

                        {loadingForms ? (
                            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                        ) : availableForms.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground bg-slate-50 rounded-lg">
                                This institution has no active questionnaires available for public selection.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {availableForms.map(form => (
                                    <div key={form.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                                        <Checkbox
                                            id={form.id}
                                            checked={selectedFormIds.includes(form.id)}
                                            onCheckedChange={() => toggleForm(form.id)}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label htmlFor={form.id} className="font-medium cursor-pointer">
                                                {form.name}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Updated {new Date(form.updatedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setStep("SEARCH")}>Cancel</Button>
                            <Button onClick={handleAdd} disabled={saving || selectedFormIds.length === 0}>
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Add Selected ({selectedFormIds.length})
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
