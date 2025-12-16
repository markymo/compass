"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Plus, Building2, ChevronRight } from "lucide-react";
import { searchFinancialInstitutions, getAvailableQuestionnaires, addRequirement } from "@/actions/requirements";
// import { toast } from "sonner"; 
import { useRouter } from "next/navigation";
// import { useDebounce } from "@/hooks/use-debounce"; // We'll need to create this hook if it doesn't exist, or just simulate it for now.

// Types matching action output
type FIResult = { id: string; name: string; _count: { questionnaires: number } };
type QuestionnaireResult = { id: string; name: string; updatedAt: Date };

export function QuestionnaireSearch({ clientLEId }: { clientLEId: string }) {
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

    // Initial Load & Debounced Search
    useEffect(() => {
        if (!open) return;

        // Initial load of defaults
        if (results.length === 0 && !query) {
            handleSearch("");
        }
    }, [open]);

    // Simple debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (open) handleSearch(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, open]);

    async function handleSearch(q: string) {
        setSearching(true);
        try {
            const res = await searchFinancialInstitutions(q);
            setResults(res);
        } catch (e) { console.error(e); }
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
            // results kept cached or reset? Resetting is safer to refresh state next open.
            setResults([]);
            setSelectedFI(null);
            setSelectedFormIds([]);
            router.refresh();
        } else {
            alert("Failed to add questionnaires");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Questionnaires
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] h-[500px] flex flex-col p-0 gap-0 overflow-hidden">

                {/* Header */}
                <div className="p-6 pb-2 border-b bg-slate-50/50">
                    <DialogHeader>
                        <DialogTitle>Add Questionnaires</DialogTitle>
                        <DialogDescription>
                            Connect with Financial Institutions to import their forms.
                        </DialogDescription>
                    </DialogHeader>

                    {step === "SEARCH" && (
                        <div className="mt-4 relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name (e.g. Goldman, JP Morgan)..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="pl-9 bg-white"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Content Area - Scrollable */}
                <div className="flex-1 overflow-y-auto p-2 bg-slate-50/30">
                    {step === "SEARCH" && (
                        <div className="space-y-1">
                            {searching && results.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                    <span className="text-xs">Searching...</span>
                                </div>
                            ) : results.length > 0 ? (
                                results.map(fi => (
                                    <div
                                        key={fi.id}
                                        className="flex items-center justify-between p-3 mx-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 cursor-pointer transition-all group"
                                        onClick={() => handleSelectFI(fi)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-full text-blue-600 dark:text-blue-400">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">{fi.name}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    {fi._count.questionnaires} Active Questionnaires
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-sm text-muted-foreground">
                                    No institutions found matching &quot;{query}&quot;.
                                </div>
                            )}
                        </div>
                    )}

                    {step === "SELECT_FORMS" && selectedFI && (
                        <div className="p-4 pt-2">
                            <div className="flex items-center gap-2 mb-6 text-sm">
                                <Button variant="ghost" size="sm" className="-ml-2 h-auto py-1 px-2 text-muted-foreground hover:text-foreground" onClick={() => setStep("SEARCH")}>
                                    &larr; Back to Search
                                </Button>
                                <span className="text-slate-300">/</span>
                                <div className="flex items-center gap-2 font-medium">
                                    <Building2 className="w-4 h-4 text-blue-500" />
                                    {selectedFI.name}
                                </div>
                            </div>

                            {loadingForms ? (
                                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                            ) : availableForms.length === 0 ? (
                                <div className="text-center py-8 text-sm text-muted-foreground bg-slate-100/50 rounded-lg border border-dashed">
                                    This institution has no active questionnaires available for public selection.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Select Questionnaires to Add</h4>
                                    {availableForms.map(form => (
                                        <div
                                            key={form.id}
                                            className={`flex items-start space-x-3 p-4 border rounded-xl transition-all cursor-pointer ${selectedFormIds.includes(form.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white hover:border-blue-200'}`}
                                            onClick={() => toggleForm(form.id)}
                                        >
                                            <Checkbox
                                                id={form.id}
                                                checked={selectedFormIds.includes(form.id)}
                                                onCheckedChange={() => toggleForm(form.id)}
                                                className="mt-1"
                                            />
                                            <div className="grid gap-1">
                                                <Label htmlFor={form.id} className="font-semibold text-sm cursor-pointer">
                                                    {form.name}
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Last updated {new Date(form.updatedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {step === "SELECT_FORMS" && (
                    <div className="p-4 border-t bg-white flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setStep("SEARCH")}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={saving || selectedFormIds.length === 0}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Selected ({selectedFormIds.length})
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

