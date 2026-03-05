"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, ShieldCheck, Building2, Users, FileText, Download } from "lucide-react";
import { MockSource } from "./sources-v2-client";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { refreshGleifProposals, getGleifProposalsFromCache, acceptProposal } from "@/actions/kyc-proposals";

interface NationalRegistrySourceDetailProps {
    source: MockSource;
    leId?: string;
    lei?: string | null;
    gleifData?: any;
    gleifFetchedAt?: Date | null;
}

export function NationalRegistrySourceDetail({ source, leId, lei, gleifData, gleifFetchedAt }: NationalRegistrySourceDetailProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isLoadingProposals, setIsLoadingProposals] = useState(false);
    const [isAcceptingAll, setIsAcceptingAll] = useState(false);
    const [proposals, setProposals] = useState<any[]>([]);

    const nationalRegistryData = gleifData?.nationalRegistryData || {};
    const officers = nationalRegistryData?.officers || [];
    const directors = officers.filter((o: any) => o.officer_role === "director");

    const companyNumber = nationalRegistryData?.company_number || "N/A";
    const registryName = gleifData?.registrationAuthorityName || "National Registry";

    // Fetch local mapped mapping from cache rather than external API
    useEffect(() => {
        if (!leId || !gleifData) return;

        const loadLocalProposals = async () => {
            setIsLoadingProposals(true);
            try {
                const result = await getGleifProposalsFromCache(leId);
                // Currently proposals are only generated for GLEIF core data, not national registry yet.
                // We keep this structure here to easily add it once mapping supports directors from National Registry.
                // if (result.success && result.proposals) {
                //    setProposals(result.proposals);
                // }
            } catch (error) {
                console.error("Local mapping failed", error);
            } finally {
                setIsLoadingProposals(false);
            }
        };

        loadLocalProposals();
    }, [leId, gleifData]);

    const handleSync = async () => {
        if (!leId) {
            toast.error("Legal Entity ID is missing");
            return;
        }
        setIsSyncing(true);
        try {
            const result = await refreshGleifProposals(leId);
            if (result.success && result.proposals) {
                toast.success("Synchronized with Registry.");
            } else {
                toast.error(result.message || "Failed to fetch Registry data");
            }
        } catch (e) {
            toast.error("An error occurred while syncing");
        } finally {
            setIsSyncing(false);
        }
    };

    const formatFetchedAt = (date?: Date | null) => {
        if (!date) return "Never synced";
        return new Date(date).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 p-6 shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 text-purple-600 font-bold text-lg">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-semibold text-slate-900 truncate" title={registryName}>
                                {registryName}
                            </h2>
                            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                <Badge variant="outline" className="font-normal border-slate-200 bg-blue-50 text-blue-700">
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    {source.category}
                                </Badge>
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold">
                                    Official Registry
                                </Badge>
                                <span className="hidden sm:inline">•</span>
                                <span className="hidden sm:inline">Last Synced: {formatFetchedAt(gleifFetchedAt)}</span>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="shrink-0"
                    >
                        <RefreshCcw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
                        <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Registry"}</span>
                        <span className="sm:hidden">{isSyncing ? "Syncing..." : "Sync"}</span>
                    </Button>
                </div>
            </div>

            {/* Tabs Section */}
            <div className="flex-1 overflow-hidden flex flex-col w-full">
                <Tabs defaultValue="preview" className="flex-1 flex flex-col w-full h-full">
                    <div className="px-6 pt-4 bg-white border-b border-slate-200 shrink-0">
                        <TabsList className="w-full justify-start bg-transparent h-10 p-0 border-b-0 space-x-6 rounded-none">
                            <TabsTrigger value="preview" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                                Identity Details
                            </TabsTrigger>
                            <TabsTrigger value="mapping" disabled className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent flex items-center gap-2">
                                Data Mapping
                            </TabsTrigger>
                            <TabsTrigger value="metadata" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                                Source Info
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto w-full p-6">
                        <TabsContent value="preview" className="m-0 space-y-6 animate-in fade-in duration-300">
                            {/* Visual representation of the API Data */}
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                <div className="border-b border-slate-100 p-4">
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-slate-400" />
                                        Company Registration
                                    </h3>
                                </div>
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Registry Name</label>
                                        <div className="font-medium text-slate-900 mt-1">{registryName}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Company Number</label>
                                        <div className="font-mono text-sm mt-1 flex items-center gap-2">
                                            {companyNumber}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                <div className="border-b border-slate-100 p-4">
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        Directors ({directors.length})
                                    </h3>
                                </div>
                                <div className="p-0">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Name</th>
                                                <th className="px-4 py-3 font-medium">Role</th>
                                                <th className="px-4 py-3 font-medium">Nationality</th>
                                                <th className="px-4 py-3 font-medium">Appointed On</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {directors.map((director: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-900">{director.name}</td>
                                                    <td className="px-4 py-3 text-slate-600 capitalize">{director.officer_role}</td>
                                                    <td className="px-4 py-3 text-slate-600">{director.nationality || "-"}</td>
                                                    <td className="px-4 py-3 text-slate-600 bg-emerald-50/30">
                                                        <span className="text-emerald-700 font-medium">{director.appointed_on || "-"}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {directors.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                                        No directors found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="metadata" className="m-0 space-y-4 animate-in fade-in duration-300">
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                                <div className="grid grid-cols-2 gap-y-4 p-5 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-slate-500">Source ID</p>
                                        <p className="font-mono text-slate-900">{source.id}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500">Verification Engine</p>
                                        <p className="font-medium text-slate-900">National Registry API Integration</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500">Data Format</p>
                                        <p className="font-medium text-slate-900">JSON (Structured)</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500">Linked Records</p>
                                        <p className="font-medium text-slate-900">{source.linkedFields} Linked Fields</p>
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-lg flex justify-between items-center">
                                    <Button variant="outline" size="sm" className="text-slate-600 bg-white">
                                        <Download className="h-4 w-4 mr-2" /> Download Raw Response
                                    </Button>
                                    <p className="text-xs text-slate-400">System Source (Cannot be deleted)</p>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
