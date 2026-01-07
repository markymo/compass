
"use client";

import { useState, useEffect } from "react";
import {
    getLibraryEngagements,
    searchAvailableQuestionnaires,
    linkQuestionnaireToLE,
    removeQuestionnaireFromLibrary,
    uploadClientQuestionnaire,
    getFIs
} from "@/actions/questionnaire-library";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Search,
    Plus,
    FileText,
    Building2,
    Upload,
    Check,
    Loader2,
    Clock,
    PlusCircle,
    ArrowRight,
    Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface QuestionnaireLibraryProps {
    leId: string;
}

export function QuestionnaireLibrary({ leId }: QuestionnaireLibraryProps) {
    const [engagements, setEngagements] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isAdding, setIsAdding] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState<string | null>(null);

    // Upload Form State
    const [fiName, setFiName] = useState("");
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    useEffect(() => {
        fetchLibrary();
        handleSearch(); // Load defaults immediately
    }, [leId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchLibrary = async () => {
        setIsLoadingLibrary(true);
        const res = await getLibraryEngagements(leId);
        if (res.success && res.data) {
            setEngagements(res.data);
        }
        setIsLoadingLibrary(false);
    };

    const handleSearch = async () => {
        setIsSearching(true);
        const res = await searchAvailableQuestionnaires(searchQuery);
        if (res.success && res.data) {
            setSearchResults(res.data);
        }
        setIsSearching(false);
    };

    const handleAddToLibrary = async (qId: string) => {
        setIsAdding(qId);
        const res = await linkQuestionnaireToLE(leId, qId);
        if (res.success) {
            // Success
            fetchLibrary();
            setSearchQuery("");
            setSearchResults([]);
        } else {
            alert("Failed to add questionnaire");
        }
        setIsAdding(null);
    };

    const handleRemove = async (qId: string) => {
        if (!confirm("Are you sure you want to remove this questionnaire from your list?")) return;

        setIsRemoving(qId);
        const res = await removeQuestionnaireFromLibrary(leId, qId);
        if (res.success) {
            // Success
            setEngagements(prev => prev.map(eng => ({
                ...eng,
                questionnaires: eng.questionnaires.filter((q: any) => q.id !== qId)
            })).filter(eng => eng.questionnaires.length > 0));
        } else {
            alert("Failed to remove questionnaire");
        }
        setIsRemoving(null);
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsUploading(true);
        const formData = new FormData(e.currentTarget);

        const res = await uploadClientQuestionnaire(leId, fiName, formData);
        if (res.success) {
            // Success
            setIsUploadModalOpen(false);
            setFiName("");
            fetchLibrary();
        } else {
            alert(res.error || "Upload failed");
        }
        setIsUploading(false);
    };

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column: Active Library */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Selected Questionnaires</h2>
                        <p className="text-slate-500">Active and prepared questionnaires for this entity</p>
                    </div>
                    <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 bg-slate-900 hover:bg-slate-800">
                                <Plus className="h-4 w-4" />
                                Add Custom
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Upload Custom Questionnaire</DialogTitle>
                                <DialogDescription>
                                    Add a document from a Financial Institution to your private library.
                                    We will automatically extract its contents.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleUpload} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fiName">Financial Institution Name</Label>
                                    <Input
                                        id="fiName"
                                        placeholder="e.g. Commerzbank"
                                        value={fiName}
                                        onChange={(e) => setFiName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="qName">Display Name (Optional)</Label>
                                    <Input id="name" name="name" placeholder="e.g. KYC Questionnaire 2024" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="file">Questionnaire Document (PDF/Docx)</Label>
                                    <Input id="file" name="file" type="file" required />
                                </div>
                                <Button type="submit" className="w-full" disabled={isUploading}>
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                    {isUploading ? "Processing..." : "Upload & Extract"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoadingLibrary ? (
                    <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-xl bg-slate-50/50">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                    </div>
                ) : engagements.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-slate-50/50 text-center space-y-2 px-6">
                        <div className="bg-white p-3 rounded-full shadow-sm border">
                            <Library className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium">Your library is empty</p>
                        <p className="text-slate-400 text-sm max-w-xs">
                            Search for FI questionnaires or upload your own to start preparing your data.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {engagements.map((eng) => (
                            <Card key={eng.id} className="overflow-hidden group hover:shadow-md transition-shadow border-slate-200">
                                <CardHeader className="pb-3 bg-slate-50/50 border-b">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-white rounded-md border shadow-sm">
                                                <Building2 className="h-4 w-4 text-slate-600" />
                                            </div>
                                            <span className="font-semibold text-slate-900">{eng.org.name}</span>
                                        </div>
                                        <Badge variant={eng.status === 'PREPARATION' ? 'outline' : 'secondary'} className="text-[10px] font-bold">
                                            {eng.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-3">
                                    {eng.questionnaires.map((q: any) => {
                                        // "Manage" if user owns it, "View" if they don't?
                                        // For now, only show Manage if ownerOrgId matches OR logic says so (but frontend doesn't know my ID easily without props)
                                        // Actually: The logic is simpler. If it's a "Custom" upload (ownerOrgId exists), we can manage it.
                                        // If it's a System one, we should probably VIEW it.
                                        // For MVP, lets just call it "Details" or "Manage" but enable the link.
                                        const canManage = !!q.ownerOrgId;

                                        return (
                                            <div key={q.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-50 transition-colors group/item relative">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="h-4 w-4 text-slate-400" />
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-700 font-medium">{q.name}</span>
                                                        {canManage && <span className="text-[10px] text-emerald-600 font-medium">Custom Upload</span>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleRemove(q.id)}
                                                        disabled={isRemoving === q.id}
                                                    >
                                                        {isRemoving === q.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>

                                                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-slate-600" asChild>
                                                        <Link href={`/app/le/${leId}/v2/questionnaire/${q.id}`}>
                                                            {canManage ? "Manage" : "View"}
                                                            <ArrowRight className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Right Column: Discovery */}
            <div className="space-y-6 h-full">
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                    <div className="p-4 border-b bg-slate-50/80">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <PlusCircle className="h-4 w-4 text-slate-500" />
                            Discover New
                        </h3>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search Financial Institutions..."
                                className="pl-9 h-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            {isSearching ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                                </div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map((q) => (
                                    <div key={q.id} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{q.fiOrg.name}</p>
                                                <p className="text-sm font-medium text-slate-900">{q.name}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-2"
                                                onClick={() => handleAddToLibrary(q.id)}
                                                disabled={isAdding === q.id}
                                            >
                                                {isAdding === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : searchQuery.length > 2 ? (
                                <div className="text-center py-8 space-y-2">
                                    <p className="text-sm text-slate-500">No official questionnaires found.</p>
                                    <p className="text-xs text-slate-400">Try uploading it as a custom doc.</p>
                                </div>
                            ) : (
                                <div className="text-center py-8 space-y-2">
                                    <p className="text-xs text-slate-400 italic">Start typing to search...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

}

// Helper icons
function Library(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m16 6 4 14" />
            <path d="M12 6v14" />
            <path d="M8 8v12" />
            <path d="M4 4v16" />
        </svg>
    )
}


