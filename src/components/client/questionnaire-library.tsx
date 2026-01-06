
"use client";

import { useState, useEffect } from "react";
import {
    getLibraryEngagements,
    searchAvailableQuestionnaires,
    linkQuestionnaireToLE,
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
    ArrowRight
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
// import { toast } from "sonner"; // Assuming sonner is available or just fallback

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

    // Upload Form State
    const [fiName, setFiName] = useState("");
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    useEffect(() => {
        fetchLibrary();
    }, [leId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length > 2) {
                handleSearch();
            } else {
                setSearchResults([]);
            }
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
            // toast?.success("Added to library");
            fetchLibrary();
            setSearchQuery("");
            setSearchResults([]);
        }
        setIsAdding(null);
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsUploading(true);
        const formData = new FormData(e.currentTarget);

        const res = await uploadClientQuestionnaire(leId, fiName, formData);
        if (res.success) {
            // toast?.success("Questionnaire uploaded and added to library");
            setIsUploadModalOpen(false);
            setFiName("");
            fetchLibrary();
        } else {
            // toast?.error("Upload failed");
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
                                    Upload to Library
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
                    <div className="grid gap-4 md:grid-cols-2">
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
                                    {eng.questionnaires.map((q: any) => (
                                        <div key={q.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-50 transition-colors group/item">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-slate-400" />
                                                <span className="text-slate-700 font-medium">{q.name}</span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity" asChild>
                                                <Link href={`/app/le/${leId}/v2/questionnaire/${q.id}`}>
                                                    Manage
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                            </Button>
                                        </div>
                                    ))}
                                    {eng.questionnaires.length === 0 && (
                                        <p className="text-xs text-slate-400 italic">No questionnaires linked</p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Right Column: Discovery */}
            <div className="space-y-6">
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
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
                                    <p className="text-xs text-slate-400 italic">Try searching for "Barclays" or "Compliance"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Card className="bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-400" />
                            Next Move
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Once your library is ready, we'll start promiting data from these documents into your
                            <span className="text-white font-semibold"> Master Standing Data</span>.
                        </p>
                        <div className="p-3 bg-white/10 rounded-lg border border-white/10">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Coming Soon</p>
                            <p className="text-xs text-white">AI-Drafting of Standing Data from Library contents.</p>
                        </div>
                    </CardContent>
                </Card>
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

import Link from "next/link";
