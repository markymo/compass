import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Save, Check, Loader2 } from "lucide-react";
import { getStandingDataSections, updateStandingDataSection } from "@/actions/standing-data";

interface StandingDataWorkbenchProps {
    leId: string;
}

const CATEGORIES = [
    { id: "CORE", label: "Core Details", description: "Legal Name, Registration, IDs" },
    { id: "STRUCTURE", label: "Corporate Structure", description: "Ownership, Subsidiaries, Directors" },
    { id: "GEOGRAPHY", label: "Geography", description: "Operating Countries, Restricted Regions" },
    { id: "PRODUCTS", label: "Products & Services", description: "Business Description, Client Types" },
    { id: "COMPLIANCE", label: "Compliance & Regulation", description: "Licenses, Policies, AML/KYC" },
];

export function StandingDataWorkbench({ leId }: StandingDataWorkbenchProps) {
    const [activeCategory, setActiveCategory] = useState("CORE");
    const [content, setContent] = useState("");
    const [sections, setSections] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Initial Load
    useEffect(() => {
        loadSections();
    }, [leId]);

    // Update content when category changes
    useEffect(() => {
        setContent(sections[activeCategory] || "");
    }, [activeCategory, sections]);

    const loadSections = async () => {
        setIsLoading(true);
        const res = await getStandingDataSections(leId);
        if (res.success && res.data) {
            setSections(res.data);
            setContent(res.data[activeCategory] || "");
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const res = await updateStandingDataSection(leId, activeCategory, content);

        if (res.success) {
            setSections(prev => ({
                ...prev,
                [activeCategory]: content
            }));
            setLastSaved(new Date());
        }
        setIsSaving(false);
    };

    return (
        <div className="grid grid-cols-12 gap-6 h-[600px]">
            {/* Sidebar */}
            <div className="col-span-4 border-r pr-6">
                <div className="mb-4">
                    <h3 className="font-semibold text-slate-900">Knowledge Base</h3>
                    <p className="text-xs text-slate-500">Select a category to manage context.</p>
                </div>
                <div className="space-y-2">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={cn(
                                "w-full text-left p-3 rounded-lg text-sm transition-all border",
                                activeCategory === cat.id
                                    ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200"
                                    : "bg-white border-transparent hover:bg-slate-50 text-slate-600"
                            )}
                        >
                            <div className="font-medium flex items-center justify-between">
                                <span className={cn(activeCategory === cat.id ? "text-emerald-900" : "text-slate-900")}>
                                    {cat.label}
                                </span>
                                {sections[cat.id] && (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                )}
                            </div>
                            <div className={cn("text-xs mt-0.5 truncate", activeCategory === cat.id ? "text-emerald-700" : "text-slate-400")}>
                                {cat.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="col-span-8 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            {CATEGORIES.find(c => c.id === activeCategory)?.label}
                        </h2>
                        <p className="text-sm text-slate-500">
                            Provide context in free-text format. Markdown supported.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastSaved && (
                            <span className="text-xs text-slate-400">
                                Saved {lastSaved.toLocaleTimeString()}
                            </span>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || content === (sections[activeCategory] || "")}
                            className={cn(
                                "gap-2 transition-all",
                                isSaving || content === (sections[activeCategory] || "")
                                    ? "bg-slate-100 text-slate-400"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>

                <div className="flex-1 relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                            <Loader2 className="h-8 w-8 text-slate-300 animate-spin" />
                        </div>
                    ) : null}
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={`Enter details for ${CATEGORIES.find(c => c.id === activeCategory)?.label}...`}
                        className="h-full resize-none p-6 text-base leading-relaxed font-mono bg-slate-50 border-slate-200 focus-visible:ring-emerald-500/20"
                    />
                </div>
            </div>
        </div>
    );
}
