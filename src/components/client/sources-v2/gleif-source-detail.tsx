"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, MapPin, Globe, Fingerprint, RefreshCcw, ArrowRight, ShieldCheck, Download, Trash2, Building2 } from "lucide-react";
import { MockSource } from "./sources-v2-client";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { refreshGleifProposals, acceptProposal, getGleifProposalsFromCache } from "@/actions/kyc-proposals";

interface GleifSourceDetailProps {
    source: MockSource;
    leId?: string;
    lei?: string | null;
    gleifData?: any;
    gleifFetchedAt?: Date | null;
}

export function GleifSourceDetail({ source, leId, lei, gleifData, gleifFetchedAt }: GleifSourceDetailProps) {
    const [isSyncing, setIsSyncing] = useState(false);

    const parsedGleif = gleifData?.attributes || gleifData?.data?.[0]?.attributes || gleifData;
    const entity = parsedGleif?.entity || {};
    const reg = parsedGleif?.registration || {};

    const extractedData = {
        lei: parsedGleif?.lei || lei || "N/A",
        legalName: entity.legalName?.name || "N/A",
        jurisdiction: entity.jurisdiction || "N/A",
        status: entity.status || "N/A",
        address: entity.legalAddress ? `${entity.legalAddress.addressLines?.[0] || ""} ${entity.legalAddress.city || ""} ${entity.legalAddress.country || ""}`.trim() : "N/A",
        registrationStatus: reg.status || "N/A",
        initialRegistration: reg.initialRegistrationDate || "N/A",
        nextRenewal: reg.nextRenewalDate || "N/A",
        registrationAuthorityID: entity.registeredAt?.id || "N/A",
        registrationAuthorityEntityID: entity.registeredAs || "N/A",
        registrationAuthorityName: gleifData?.registrationAuthorityName || "Unknown (Click 'Sync Registry')"
    };

    const [isLoadingProposals, setIsLoadingProposals] = useState(false);
    const [isAcceptingAll, setIsAcceptingAll] = useState(false);
    const [proposals, setProposals] = useState<any[]>([]);

    // Fetch local mapped mapping from cache rather than external API
    useEffect(() => {
        if (!leId || !gleifData) return;

        const loadLocalProposals = async () => {
            setIsLoadingProposals(true);
            try {
                const result = await getGleifProposalsFromCache(leId);
                if (result.success && result.proposals) {
                    setProposals(result.proposals);
                }
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
                setProposals(result.proposals);
                if (result.proposals.filter((p: any) => p.action === 'PROPOSE_UPDATE').length > 0) {
                    toast.success("Synchronized with GLEIF. Updates available.");
                } else {
                    toast.success("Synchronized with GLEIF. Master record is in sync.");
                }
            } else {
                toast.error(result.message || "Failed to fetch GLEIF proposals");
            }
        } catch (e) {
            toast.error("An error occurred while syncing");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAcceptAll = async () => {
        if (!leId) return;
        const updates = proposals.filter(p => p.action === 'PROPOSE_UPDATE' && p.proposed?.evidenceId);
        if (updates.length === 0) return;

        setIsAcceptingAll(true);
        try {
            let successCount = 0;
            // Iterate sequentially to avoid db concurrency issues on the same record
            for (const proposal of updates) {
                const result = await acceptProposal(leId, proposal.fieldNo, proposal.proposed.evidenceId);
                if (result.success) successCount++;
            }
            if (successCount > 0) {
                toast.success(`Successfully accepted ${successCount} mapped fields`);
                // Refresh local proposals
                const refreshResult = await getGleifProposalsFromCache(leId);
                if (refreshResult.success && refreshResult.proposals) {
                    setProposals(refreshResult.proposals);
                }
            } else {
                toast.error("Failed to accept updates");
            }
        } catch (e) {
            toast.error("An error occurred during bulk accept");
        } finally {
            setIsAcceptingAll(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} to clipboard`);
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
                        <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 text-orange-600 font-bold text-lg">
                            GL
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-semibold text-slate-900 truncate" title={source.name}>
                                {source.name}
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
                            <TabsTrigger value="mapping" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 pb-2 pt-2 bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent flex items-center gap-2">
                                Data Mapping
                                {proposals.filter(p => p.action === 'PROPOSE_UPDATE').length > 0 && (
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-1.5 h-5 rounded-md">
                                        {proposals.filter(p => p.action === 'PROPOSE_UPDATE').length} new
                                    </Badge>
                                )}
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
                                        <Fingerprint className="h-4 w-4 text-slate-400" />
                                        Core Identity
                                    </h3>
                                </div>
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Legal Name</label>
                                        <div className="font-medium text-slate-900 mt-1">{extractedData.legalName}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">LEI Code</label>
                                        <div className="font-mono text-sm mt-1 flex items-center gap-2">
                                            {extractedData.lei}
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-slate-100" onClick={() => copyToClipboard(extractedData.lei || "", "LEI")}>
                                                <Copy className="h-3 w-3 text-slate-400" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Jurisdiction</label>
                                        <div className="text-sm mt-1 flex items-center gap-1.5">
                                            <Globe className="h-3.5 w-3.5 text-slate-400" />
                                            {extractedData.jurisdiction}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Entity Status</label>
                                        <div className="mt-1">
                                            <Badge variant={extractedData.status === 'ACTIVE' ? 'default' : 'secondary'} className="font-normal">
                                                {extractedData.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                <div className="border-b border-slate-100 p-4">
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-slate-400" />
                                        Registered Address
                                    </h3>
                                </div>
                                <div className="p-4">
                                    <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100">
                                        {extractedData.address}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                <div className="border-b border-slate-100 p-4 flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-slate-400" />
                                        National Registry Link
                                    </h3>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium">Source Reference</Badge>
                                </div>
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Authority ID
                                        </label>
                                        <div className="font-medium text-slate-900 mt-1">{extractedData.registrationAuthorityID}</div>
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            {extractedData.registrationAuthorityName}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Registry Entity ID
                                        </label>
                                        <div className="font-mono text-sm mt-1">{extractedData.registrationAuthorityEntityID}</div>
                                        <p className="text-[11px] text-slate-500 mt-1">Company Number cross-reference</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="mapping" className="m-0 space-y-4 animate-in fade-in duration-300">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Automatic Field Mapping</p>
                                        <p className="mt-1 text-blue-700">
                                            Because this is an Official Registry source, its structured data is automatically mapped to verified Master Record fields. Below are the mappings and proposed updates.
                                        </p>
                                    </div>
                                </div>
                                {proposals.filter(p => p.action === 'PROPOSE_UPDATE').length > 1 && (
                                    <Button
                                        size="sm"
                                        onClick={handleAcceptAll}
                                        disabled={isAcceptingAll || isSyncing || isLoadingProposals}
                                        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 h-8 text-xs"
                                    >
                                        {isAcceptingAll ? "Accepting..." : "Accept All"}
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-3 mt-4">
                                {isLoadingProposals || isSyncing ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <RefreshCcw className="h-6 w-6 animate-spin text-slate-300" />
                                        <p className="text-sm font-medium">Re-mapping registry fields...</p>
                                    </div>
                                ) : proposals.length > 0 ? (
                                    <>
                                        {proposals.map((proposal, idx) => (
                                            <div key={idx} className={cn(
                                                "bg-white border rounded-lg p-4 shadow-sm transition-colors",
                                                proposal.action === 'PROPOSE_UPDATE' ? "border-indigo-200" : "border-slate-200"
                                            )}>
                                                {/* Card Header */}
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                                    <div className="flex items-center gap-2 font-medium text-slate-900">
                                                        <span className="text-base">{proposal.fieldName}</span>
                                                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 font-mono">F{proposal.fieldNo}</Badge>
                                                    </div>
                                                    {proposal.action === 'PROPOSE_UPDATE' ? (
                                                        <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 px-4 shadow-sm" onClick={async () => {
                                                            if (!leId || !proposal.proposed?.evidenceId) return;
                                                            try {
                                                                await acceptProposal(leId, proposal.fieldNo, proposal.proposed.evidenceId);
                                                                toast.success(`Updated ${proposal.fieldName}`);
                                                                const result = await getGleifProposalsFromCache(leId);
                                                                if (result.success && result.proposals) {
                                                                    setProposals(result.proposals);
                                                                }
                                                            } catch (e) {
                                                                toast.error("Failed to accept update");
                                                            }
                                                        }}>
                                                            Accept Mapped Detail
                                                        </Button>
                                                    ) : (
                                                        <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                                            <ShieldCheck className="h-4 w-4" /> In Sync
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Data Flow Interface: Source (Left) -> Arrow (Mid) -> Target (Right) */}
                                                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch text-sm group">

                                                    {/* LEFT: SOURCE (GLEIF) */}
                                                    <div className={cn(
                                                        "p-3 rounded-md border flex flex-col justify-between transition-colors",
                                                        proposal.action === 'PROPOSE_UPDATE' ? "bg-green-50/50 border-green-200" : "bg-slate-50/80 border-slate-200"
                                                    )}>
                                                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex justify-between items-center tracking-wider">
                                                            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-slate-400" /> Source Fact (Registry)</span>
                                                            {gleifFetchedAt && <span className="font-medium text-slate-400 normal-case" title={String(gleifFetchedAt)}>{formatFetchedAt(gleifFetchedAt)}</span>}
                                                        </div>
                                                        <div className={cn(
                                                            "font-mono text-[13px] break-all",
                                                            proposal.action === 'PROPOSE_UPDATE' ? "text-green-800 font-medium" : "text-slate-700 font-medium"
                                                        )} title={String(proposal.proposed?.value || "")}>
                                                            {proposal.proposed?.value || <span className="text-slate-400 italic font-sans normal-case">Empty mapping</span>}
                                                        </div>
                                                    </div>

                                                    {/* MIDDLE: ARROW */}
                                                    <div className="flex items-center justify-center relative w-6">
                                                        <div className={cn(
                                                            "absolute bg-white border shadow-sm h-8 w-8 rounded-full flex items-center justify-center z-10 transition-colors",
                                                            proposal.action === 'PROPOSE_UPDATE' ? "border-indigo-100 shadow-indigo-100" : "border-slate-100"
                                                        )}>
                                                            <ArrowRight className={cn(
                                                                "h-4 w-4",
                                                                proposal.action === 'PROPOSE_UPDATE' ? "text-indigo-500" : "text-slate-300"
                                                            )} />
                                                        </div>
                                                        {proposal.action === 'PROPOSE_UPDATE' && (
                                                            <div className="absolute h-0.5 max-w-[calc(100%+24px)] w-full bg-gradient-to-r from-green-200 via-indigo-200 to-red-200 -z-0"></div>
                                                        )}
                                                    </div>

                                                    {/* RIGHT: TARGET (MASTER RECORD) */}
                                                    <div className={cn(
                                                        "p-3 rounded-md border flex flex-col justify-between transition-colors",
                                                        proposal.action === 'PROPOSE_UPDATE' ? "bg-red-50/30 border-red-100" : "bg-slate-50/80 border-slate-200"
                                                    )}>
                                                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider flex justify-between items-center">
                                                            <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400" /> Master Record</span>
                                                            <span className="text-slate-400 font-medium normal-case">
                                                                {proposal.current?.source === 'SYSTEM' ? 'Previous' : (proposal.current?.source || "None")}
                                                            </span>
                                                        </div>
                                                        <div className={cn(
                                                            "font-mono text-[13px] break-all",
                                                            proposal.action === 'PROPOSE_UPDATE' ? "text-red-800/80 line-through decoration-red-300 decoration-2" : "text-slate-700 font-medium"
                                                        )} title={String(proposal.current?.value || "Empty")}>
                                                            {proposal.current?.value || <span className="text-slate-400 italic normal-case decoration-transparent font-sans">Empty</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-center py-8 bg-slate-50 border border-dashed rounded-lg text-slate-500 text-sm flex flex-col items-center justify-center">
                                        <p>No mapped fields computed yet.</p>
                                        <p className="text-xs text-slate-400 mt-1">Click Sync Registry to check for updates against live database.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="metadata" className="m-0 animate-in fade-in duration-300">
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 p-5 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-slate-500 font-medium text-[11px] uppercase tracking-widest">Source ID</p>
                                        <p className="font-mono text-slate-900 bg-slate-50 border border-slate-100 px-2 py-1 rounded inline-block">{source.id}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500 font-medium text-[11px] uppercase tracking-widest">Integration Path</p>
                                        <p className="text-slate-900 font-mono text-xs text-blue-600">GET /api/v1/lei-records</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500 font-medium text-[11px] uppercase tracking-widest">Data Type</p>
                                        <p className="text-slate-900 font-medium">Structured JSON (API)</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500 font-medium text-[11px] uppercase tracking-widest">Category Classification</p>
                                        <p className="text-slate-900 font-medium">{source.category} (Highest Precedence)</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500 font-medium text-[11px] uppercase tracking-widest">Connected By</p>
                                        <p className="text-slate-900 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                                {source.uploadedBy.substring(0, 1)}
                                            </span>
                                            {source.uploadedBy}
                                        </p>
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-lg flex justify-between items-center">
                                    <Button variant="outline" size="sm" className="bg-white">
                                        <Download className="h-4 w-4 mr-2 text-slate-400" />
                                        Download Raw JSON
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                                        Remove Source
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
