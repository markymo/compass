"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Fingerprint, RefreshCcw, ArrowRight, ShieldCheck, Ban, Info, Building2, FileText, Users, Sparkles, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { toast } from "sonner";
import { refreshGleifProposals, acceptProposal } from "@/actions/kyc-proposals";
import { refreshRegistryReferenceAction } from "@/actions/registry";
import { FieldProposal, ProvenanceSource } from "@/domain/kyc/types/ProposalTypes";
import { cn } from "@/lib/utils";
import { getSourceDisplayName } from "@/lib/source-display";
import { FieldDetailPanel } from "./inspection/field-detail-panel";
import { isAddressValue, getAddressSummary } from "@/lib/master-data/address-value";
import { isPersonOrContactValue, getPersonOrContactSummary } from "@/lib/master-data/person-or-contact-value";
import { Input } from "@/components/ui/input";
import { Search, Filter, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

interface CategoryDef {
    id: string;
    key: string;
    displayName: string;
    order: number;
    fields: any[];
}

interface DataSchemaTabProps {
    leId: string;
    masterData: Record<number, { 
        value: any; 
        source?: string; 
        sourceReference?: string;
        displayState?: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE";
        defaultResponse?: string;
    }>;
    customData?: Record<string, any>;
    customDefinitions?: any[];
    gleifLastSynced?: Date;
    masterFields: any[];
    masterGroups: any[];
    categories?: CategoryDef[];
    uncategorizedFields?: any[];
    nationalRegistryData?: {
        id: string;
        authorityName: string;
        localRegistrationNumber: string;
        lastSyncSucceededAt: Date | null;
        lastSyncStatus: string | null;
    } | null;
    /** The GLEIF RA code for this specific entity, e.g. RA000585. Threaded into SourceBadge
     *  to show the entity-specific authority identifier alongside the canonical source name. */
    registrationAuthorityId?: string;
}

export function DataSchemaTab({ leId, masterData, customData = {}, customDefinitions = [], gleifLastSynced, masterFields = [], masterGroups = [], categories = [], uncategorizedFields = [], nationalRegistryData, registrationAuthorityId }: DataSchemaTabProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [proposals, setProposals] = useState<FieldProposal[] | null>(null);
    const [selectedField, setSelectedField] = useState<{ fieldNo: number; name: string; customFieldId?: string } | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(gleifLastSynced);
    const [isRefreshingRegistry, setIsRefreshingRegistry] = useState(false);
    const [proposalsExpanded, setProposalsExpanded] = useState(false);
    const [autoCollapseProgress, setAutoCollapseProgress] = useState(100); // 100→0 over 6s
    const collapseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [search, setSearch] = useState("");
    const [catFilter, setCatFilter] = useState("ALL");
    const [popFilter, setPopFilter] = useState("ALL");

    const fieldGroupMap = useMemo(() => {
        const map = new Map<number, { id: string; label: string }[]>();
        if (!masterGroups) return map;
        for (const group of masterGroups) {
            const fieldNos: number[] = group.fieldNos || 
                group.items?.map((item: any) => item.fieldNo) || 
                [];
            for (const fieldNo of fieldNos) {
                if (!map.has(fieldNo)) {
                    map.set(fieldNo, []);
                }
                map.get(fieldNo)!.push({
                    id: group.id,
                    label: group.label
                });
            }
        }
        return map;
    }, [masterGroups]);

    const categoryList = useMemo(() => {
        return categories.map((cat: any) => {
            let icon = FileText;
            const k = cat.key.toLowerCase();
            if (k.includes('identity')) icon = Fingerprint;
            if (k.includes('constitutional') || k.includes('entity')) icon = Building2;
            if (k.includes('relationship') || k.includes('owners')) icon = Users;
            if (k.includes('lei') || k.includes('registration')) icon = ShieldCheck;
            return {
                ...cat,
                icon
            };
        });
    }, [categories]);

    // Filtering logic
    const filteredCustomFields = useMemo(() => {
        return customDefinitions.filter((def: any) => {
            const val = customData[def.id] || customData[def.key];
            const hasValue = val !== null && val !== undefined && (typeof val === 'object' ? val.value !== "" : val !== "");

            const matchesSearch = def.label.toLowerCase().includes(search.toLowerCase()) ||
                (def.description && def.description.toLowerCase().includes(search.toLowerCase()));
            const matchesCat = catFilter === "ALL" || catFilter === "CUSTOM";
            const matchesPop = popFilter === "ALL" || (popFilter === "POPULATED" ? hasValue : !hasValue);

            return matchesSearch && matchesCat && matchesPop;
        });
    }, [customDefinitions, customData, search, catFilter, popFilter]);

    const filteredCategories = useMemo(() => {
        return categoryList.map((cat: any) => {
            const fields = cat.fields.filter((f: any) => {
                const data = masterData[f.fieldNo];
                const hasValue = data?.value !== null && data?.value !== undefined && data?.value !== "";

                const matchesSearch = f.fieldName.toLowerCase().includes(search.toLowerCase()) ||
                    (f.description && f.description.toLowerCase().includes(search.toLowerCase()));
                const matchesPop = popFilter === "ALL" || (popFilter === "POPULATED" ? hasValue : !hasValue);

                return matchesSearch && matchesPop;
            });

            return { ...cat, fields };
        }).filter((cat: any) => {
            const matchesCat = catFilter === "ALL" || catFilter === cat.id;
            return matchesCat && cat.fields.length > 0;
        });
    }, [categoryList, masterData, search, catFilter, popFilter]);

    const filteredUncategorized = useMemo(() => {
        if (catFilter !== "ALL" && catFilter !== "UNCATEGORIZED") return [];

        return uncategorizedFields.filter((f: any) => {
            const data = masterData[f.fieldNo];
            const hasValue = data?.value !== null && data?.value !== undefined && data?.value !== "";

            const matchesSearch = f.fieldName.toLowerCase().includes(search.toLowerCase()) ||
                (f.description && f.description.toLowerCase().includes(search.toLowerCase()));
            const matchesPop = popFilter === "ALL" || (popFilter === "POPULATED" ? hasValue : !hasValue);

            return matchesSearch && matchesPop;
        });
    }, [uncategorizedFields, masterData, search, catFilter, popFilter]);

    const totalVisible = filteredCustomFields.length + filteredCategories.reduce((acc: any, c: any) => acc + c.fields.length, 0) + filteredUncategorized.length;


    // Auto-collapse timer: when proposals are shown, start a 6s countdown then collapse.
    useEffect(() => {
        if (!proposals || proposals.filter((p: any) => p.action !== 'NO_CHANGE').length === 0) return;

        // Reset and expand whenever new proposals arrive
        setProposalsExpanded(true);
        setAutoCollapseProgress(100);

        // Clear any existing timer
        if (collapseTimerRef.current) clearInterval(collapseTimerRef.current);

        const DURATION_MS = 6000;
        const TICK_MS = 50;
        const step = (TICK_MS / DURATION_MS) * 100;
        let progress = 100;

        collapseTimerRef.current = setInterval(() => {
            progress -= step;
            setAutoCollapseProgress(Math.max(0, progress));
            if (progress <= 0) {
                clearInterval(collapseTimerRef.current!);
                collapseTimerRef.current = null;
                setProposalsExpanded(false);
            }
        }, TICK_MS);

        return () => {
            if (collapseTimerRef.current) clearInterval(collapseTimerRef.current);
        };
    }, [proposals]);

    const handleRefreshGleif = async () => {
        setIsRefreshing(true);
        try {
            const result = await refreshGleifProposals(leId);
            if (result.success && result.proposals) {
                setProposals(result.proposals);
                if (result.proposals.length === 0) {
                    toast.info("GLEIF data matches current records. No updates proposed.");
                } else {
                    toast.success(`${result.proposals.filter((p: any) => p.action !== 'NO_CHANGE').length} field update${result.proposals.filter((p: any) => p.action !== 'NO_CHANGE').length === 1 ? '' : 's'} available from external sources.`);
                }
            } else {
                toast.error(result.message || "Failed to refresh GLEIF data");
            }
        } catch (e) {
            toast.error("An error occurred while refreshing");
        } finally {
            setIsRefreshing(false);
            setLastRefreshed(new Date());
        }
    };

    const handleAccept = async (proposal: FieldProposal) => {
        if (!proposal.proposed?.evidenceId) return;

        try {
            const result = await acceptProposal(leId, proposal.fieldNo, proposal.proposed.evidenceId);
            if (result.success) {
                toast.success(`Field ${proposal.fieldNo} updated successfully`);
                setProposals(prev => prev ? prev.filter((p: any) => p.fieldNo !== proposal.fieldNo) : null);
                // Ideally refresh page here or update local state
            } else {
                toast.error(result.message || "Update failed");
            }
        } catch (e) {
            toast.error("An error occurred during acceptance");
        }
    };

    const handleRefreshRegistry = async () => {
        if (!nationalRegistryData?.id) return;
        setIsRefreshingRegistry(true);
        try {
            const result = await refreshRegistryReferenceAction(leId, nationalRegistryData.id);
            if (result.success) {
                toast.success("Registry data synchronized successfully.");
            } else {
                toast.error(result.error || "Failed to refresh registry data.");
            }
        } catch (e) {
            toast.error("An unexpected error occurred while refreshing the registry.");
        } finally {
            setIsRefreshingRegistry(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* External Sources — compact full-width bar at the top */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-base font-semibold text-slate-800">External Sources</h2>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* GLEIF Source */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden border border-orange-200">
                                    <img 
                                        src="https://www.gleif.org/assets/build/img/logo/gleif-logo-new.svg" 
                                        alt="GLEIF Logo" 
                                        className="h-4 w-auto scale-150"
                                    />
                                </div>
                                <div>
                                    <div className="font-medium text-sm">Global LEI Index (GLEIF)</div>
                                    <div className="text-xs text-slate-500">
                                        {lastRefreshed
                                            ? <>Last synced: <span className="font-medium text-slate-700">{lastRefreshed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span> at <span className="font-medium text-slate-700">{lastRefreshed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></>
                                            : "Never synced"}
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefreshGleif}
                                disabled={isRefreshing}
                            >
                                <RefreshCcw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                                {isRefreshing ? "Checking..." : "Check for Updates"}
                            </Button>
                        </div>

                        {/* National Registry Source */}
                        {nationalRegistryData && (
                            <div className="flex items-center gap-4 lg:border-l lg:pl-6 border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/50">
                                        {nationalRegistryData.authorityName.includes("Companies House") ? (
                                            <img src="/images/Companies_House.png" alt="Companies House" className="h-4 w-auto scale-110" />
                                        ) : (
                                            <Building2 className="h-4 w-4 text-emerald-600" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm">{nationalRegistryData.authorityName} - {nationalRegistryData.localRegistrationNumber}</div>
                                        <div className="text-xs text-slate-500">
                                            {nationalRegistryData.lastSyncSucceededAt
                                                ? <>Last synced: <span className="font-medium text-slate-700">{new Date(nationalRegistryData.lastSyncSucceededAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span> at <span className="font-medium text-slate-700">{new Date(nationalRegistryData.lastSyncSucceededAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></>
                                                : "Never synced"}
                                            {nationalRegistryData.lastSyncStatus === "FAILED" && <span className="ml-2 text-red-500 font-medium">Sync Failed</span>}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefreshRegistry}
                                    disabled={isRefreshingRegistry}
                                >
                                    <RefreshCcw className={cn("mr-2 h-4 w-4", isRefreshingRegistry && "animate-spin")} />
                                    {isRefreshingRegistry ? "Checking..." : "Check for Updates"}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Proposals Panel — ephemeral flash notification, auto-collapses after 6s */}
                {proposals && (() => {
                    const actionable = proposals.filter((p: any) => p.action !== 'NO_CHANGE');
                    const updateCount = actionable.filter((p: any) => p.action === 'PROPOSE_UPDATE').length;
                    const blockedCount = actionable.filter((p: any) => p.action === 'BLOCKED').length;

                    if (actionable.length === 0) return (
                        <div className="mt-5 pt-5 border-t border-slate-100 animate-in fade-in duration-300">
                            <p className="text-sm text-slate-500 text-center py-3">
                                ✓ All fields are in sync — no updates found.
                            </p>
                        </div>
                    );

                    const summaryParts: string[] = [];
                    if (updateCount > 0) summaryParts.push(`${updateCount} field${updateCount === 1 ? '' : 's'} have updated values`);
                    if (blockedCount > 0) summaryParts.push(`${blockedCount} blocked by priority rules`);

                    return (
                        <div className="mt-5 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-300">
                            {/* Summary header row */}
                            <button
                                onClick={() => {
                                    // Manual toggle cancels the auto-collapse timer
                                    if (collapseTimerRef.current) {
                                        clearInterval(collapseTimerRef.current);
                                        collapseTimerRef.current = null;
                                        setAutoCollapseProgress(0);
                                    }
                                    setProposalsExpanded(prev => !prev);
                                }}
                                className="w-full flex items-center justify-between gap-3 text-left group"
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                                    <span className="text-sm font-medium text-slate-700">
                                        {summaryParts.join(' · ')}
                                    </span>
                                    {blockedCount > 0 && (
                                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                                            {blockedCount} blocked
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {autoCollapseProgress > 0 && (
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            auto-closing
                                        </span>
                                    )}
                                    {proposalsExpanded
                                        ? <ChevronUp className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                                        : <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                                    }
                                </div>
                            </button>

                            {/* Draining progress bar */}
                            {autoCollapseProgress > 0 && (
                                <div className="mt-2 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-400 rounded-full transition-none"
                                        style={{ width: `${autoCollapseProgress}%` }}
                                    />
                                </div>
                            )}

                            {/* Row list */}
                            {proposalsExpanded && (
                                <div className="mt-3 rounded-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                    {/* Column header */}
                                    <div className="grid grid-cols-[2fr_3fr_auto] gap-x-4 px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Field</span>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current → Proposed</span>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"></span>
                                    </div>
                                    {actionable.map((proposal: any, idx: number) => (
                                        <ProposalRow
                                            key={proposal.fieldNo}
                                            proposal={proposal}
                                            isLast={idx === actionable.length - 1}
                                            onAccept={() => handleAccept(proposal)}
                                            onDismiss={() => setProposals(prev => prev ? prev.filter((p: any) => p.fieldNo !== proposal.fieldNo) : null)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Master Record — full width */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Master Record</h2>
                        <p className="text-slate-500 text-sm mt-1">
                            Source record
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 items-center">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search fields..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-white border-slate-200 focus-visible:ring-blue-500"
                            />
                        </div>

                        <Select value={catFilter} onValueChange={setCatFilter}>
                            <SelectTrigger className="w-full md:w-[180px] bg-white border-slate-200">
                                <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Categories</SelectItem>
                                {customDefinitions.length > 0 && <SelectItem value="CUSTOM">Custom Fields</SelectItem>}
                                {categoryList.map((cat: any) => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.displayName}</SelectItem>
                                ))}
                                {uncategorizedFields.length > 0 && <SelectItem value="UNCATEGORIZED">Uncategorized</SelectItem>}
                            </SelectContent>
                        </Select>

                        <Select value={popFilter} onValueChange={setPopFilter}>
                            <SelectTrigger className="w-full md:w-[160px] bg-white border-slate-200">
                                <span className="flex items-center gap-2">
                                    {popFilter === 'POPULATED' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-slate-300" />}
                                    <SelectValue placeholder="Status" />
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Status</SelectItem>
                                <SelectItem value="POPULATED">Populated</SelectItem>
                                <SelectItem value="EMPTY">Missing Data</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Master Record Content */}
                <div className="space-y-6">
                    {/* Custom Fields */}
                    {filteredCustomFields.length > 0 && (
                        <Card className="border-l-4 border-l-purple-500 shadow-sm overflow-hidden animate-in fade-in duration-300">
                            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-purple-50/30">
                                <CardTitle className="flex items-center gap-2 text-lg text-purple-900">
                                    <Sparkles className="h-5 w-5 text-purple-600" />
                                    Custom Fields
                                </CardTitle>
                                <CardDescription className="text-purple-700/70">
                                    Organization-specific data points
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                {filteredCustomFields.map((def: any) => {
                                    const value = customData[def.id] || customData[def.key];
                                    return (
                                        <MasterFieldDisplay
                                            key={def.id}
                                            label={def.label}
                                            fieldNo={0}
                                            value={value?.value || value}
                                            source={value?.source || 'USER_INPUT'}
                                            description={def.description}
                                            isCustom={true}
                                            onClick={() => setSelectedField({
                                                fieldNo: 0,
                                                name: def.label,
                                                customFieldId: def.id
                                            })}
                                        />
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {filteredCategories.map((group: any) => {
                        const Icon = group.icon;
                        return (
                            <Card key={group.id} className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden animate-in fade-in duration-300">
                                <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Icon className="h-5 w-5 text-blue-600" />
                                        {group.displayName}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    {group.fields.map((field: any) => {
                                        const data = masterData[field.fieldNo];
                                        return (
                                            <MasterFieldDisplay
                                                key={field.fieldNo}
                                                label={field.fieldName}
                                                fieldNo={field.fieldNo}
                                                value={data?.value}
                                                source={data?.source as any}
                                                sourceReference={data?.sourceReference}
                                                description={field.description}
                                                registrationAuthorityId={registrationAuthorityId}
                                                groups={fieldGroupMap.get(field.fieldNo)}
                                                displayState={data?.displayState}
                                                defaultResponse={data?.defaultResponse}
                                                onClick={() => setSelectedField({ fieldNo: field.fieldNo, name: field.fieldName })}
                                            />
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        );
                    })}

                    {filteredUncategorized.length > 0 && (
                        <Card className="border-l-4 border-l-slate-400 shadow-sm overflow-hidden opacity-80 animate-in fade-in duration-300">
                            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <FileText className="h-5 w-5 text-slate-500" />
                                    Uncategorized
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                {filteredUncategorized.map((field: any) => {
                                    const data = masterData[field.fieldNo];
                                    return (
                                        <MasterFieldDisplay
                                            key={field.fieldNo}
                                            label={field.fieldName}
                                            fieldNo={field.fieldNo}
                                            value={data?.value}
                                            source={data?.source as any}
                                            sourceReference={data?.sourceReference}
                                            description={field.description}
                                            registrationAuthorityId={registrationAuthorityId}
                                            groups={fieldGroupMap.get(field.fieldNo)}
                                            displayState={data?.displayState}
                                            defaultResponse={data?.defaultResponse}
                                            onClick={() => setSelectedField({ fieldNo: field.fieldNo, name: field.fieldName })}
                                        />
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {totalVisible === 0 && (
                        <div className="py-20 text-center bg-white rounded-xl border border-dashed border-slate-300 animate-in fade-in duration-300">
                            <AlertCircle className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-slate-900">No matching fields</h3>
                            <p className="text-slate-500 mt-1">Try adjusting your filters or search terms.</p>
                            <Button
                                variant="link"
                                onClick={() => { setSearch(""); setCatFilter("ALL"); setPopFilter("ALL"); }}
                                className="text-blue-500 mt-2"
                            >
                                Clear all filters
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Inspector Panel */}
            <FieldDetailPanel
                open={!!selectedField}
                onOpenChange={(open) => !open && setSelectedField(null)}
                clientLEId={leId}
                fieldNo={selectedField?.fieldNo || 0}
                fieldName={selectedField?.name || ""}
                customFieldId={selectedField?.customFieldId}
                registrationAuthorityId={registrationAuthorityId}
            />
        </div>
    );
}

function MasterFieldDisplay({ label, fieldNo, value, source, sourceReference, registrationAuthorityId, onClick, description, isCustom, groups = [], displayState, defaultResponse }: {
    label: string,
    fieldNo: number,
    value: any,
    source?: ProvenanceSource,
    sourceReference?: string,
    /** Entity-specific GLEIF RA code — passed to SourceBadge for RA sources only. */
    registrationAuthorityId?: string,
    onClick?: () => void,
    description?: string,
    isCustom?: boolean,
    groups?: { id: string; label: string }[],
    displayState?: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE",
    defaultResponse?: string
}) {
    const hasValue = value !== null && value !== undefined && value !== "";
    const resolvedState = displayState || (hasValue ? "HAS_VALUE" : (source ? "CHECKED_NO_DATA" : "UNMAPPED_NO_RESPONSE"));

    // Format Value for Display
    let displayValue = value;

    if (hasValue) {
        displayValue = formatGraphValue(value);
    }

    return (
        <div
            className={cn("group transition-all duration-200", onClick && "cursor-pointer hover:translate-x-1")}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="flex flex-col">
                    <label className={cn("text-sm font-medium text-slate-700", onClick && "group-hover:text-blue-600 transition-colors")}>
                        {label}
                    </label>
                    {description && (
                        <span className="text-[10px] text-slate-400 italic font-normal">{description}</span>
                    )}
                </div>
                {!isCustom && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <TooltipProvider delayDuration={150}>
                            {groups.map(group => (
                                <Tooltip key={group.id}>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] bg-indigo-50/40 text-indigo-600 border-indigo-200/50 font-medium"
                                        >
                                            CF: {group.label}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs bg-slate-900 text-white border-slate-800">
                                        Composite Field: {group.label}
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </TooltipProvider>
                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                            Field {fieldNo}
                        </Badge>
                    </div>
                )}
                {isCustom && (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200">
                        Custom
                    </Badge>
                )}
            </div>

            <div className={cn(
                "flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100 transition-all",
                onClick && "group-hover:border-blue-200 group-hover:bg-white group-hover:shadow-sm"
            )}>
                <div className="font-mono text-sm truncate max-w-[300px]" title={typeof value === 'object' && value ? JSON.stringify(value, null, 2) : String(value)}>
                    {resolvedState === "HAS_VALUE" && displayValue}
                    {resolvedState === "MAPPED_NOT_CHECKED" && <span className="text-slate-400 italic">Source not checked yet</span>}
                    {resolvedState === "CHECKED_NO_DATA" && <span className="text-slate-400 italic">No data in source record</span>}
                    {resolvedState === "DEFAULT_RESPONSE" && (
                        <span className="flex items-center gap-2">
                            <span>{defaultResponse}</span>
                            <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-slate-500 bg-slate-50 border-slate-200">Field Default</Badge>
                        </span>
                    )}
                    {resolvedState === "UNMAPPED_NO_RESPONSE" && <span className="text-slate-400 italic">No response recorded</span>}
                </div>
                {(resolvedState === "HAS_VALUE" || resolvedState === "MAPPED_NOT_CHECKED" || resolvedState === "CHECKED_NO_DATA") && source && (
                    <div className="flex items-center gap-2">
                        {/* If we had meta timestamp, we'd pass it. For now just source if available. */}
                        <SourceBadge source={source} sourceReference={sourceReference} registrationAuthorityId={registrationAuthorityId} />
                    </div>
                )}
                {!hasValue && !isCustom && (
                    <div className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 flex items-center gap-1 transition-opacity">
                        <Info className="h-3 w-3" /> Inspect
                    </div>
                )}
            </div>
        </div>
    );
}

/** Colour classes keyed by SourceType enum value (or legacy source type strings). */
const SOURCE_COLOR_MAP: Record<string, string> = {
    GLEIF:                  'bg-orange-100 text-orange-700 border-orange-200',
    REGISTRATION_AUTHORITY: 'bg-blue-100   text-blue-700  border-blue-200',
    COMPANIES_HOUSE:        'bg-blue-100   text-blue-700  border-blue-200',
    NATIONAL_REGISTRY:      'bg-blue-100   text-blue-700  border-blue-200',
    USER_INPUT:             'bg-purple-100 text-purple-700 border-purple-200',
    SYSTEM:                 'bg-gray-100   text-gray-700  border-gray-200',
    SYSTEM_DERIVED:         'bg-gray-100   text-gray-700  border-gray-200',
    MASTER_RECORD:          'bg-slate-100  text-slate-700 border-slate-200',
};

/**
 * Pure presentation badge — delegates all label resolution to getSourceDisplayName.
 * Shows the entity-specific GLEIF RA code as a subtle secondary label for RA sources.
 * To change how any source is displayed, update source-display.ts only.
 */
function SourceBadge({ source, sourceReference, registrationAuthorityId, timestamp }: {
    source: string,
    sourceReference?: string,
    /** Entity-specific GLEIF RA code, e.g. RA000585. Only shown for REGISTRATION_AUTHORITY sources. */
    registrationAuthorityId?: string,
    timestamp?: string
}) {
    const classes = SOURCE_COLOR_MAP[source] || SOURCE_COLOR_MAP['SYSTEM'];
    const label = getSourceDisplayName(source, sourceReference ?? null);
    const showRaCode = source === 'REGISTRATION_AUTHORITY' && registrationAuthorityId;

    return (
        <Badge variant="outline" className={cn("text-[10px] h-auto py-0.5", classes)}>
            <span>{label}</span>
            {showRaCode && (
                <span className="ml-1 opacity-60 font-mono normal-case tracking-normal">
                    · {registrationAuthorityId}
                </span>
            )}
            {timestamp && <span className="ml-1 opacity-50">· {new Date(timestamp).toLocaleDateString()}</span>}
        </Badge>
    );
}

export function formatGraphValue(val: any): string {
    if (val === null || val === undefined || val === '') return '';
    if (val instanceof Date) return val.toLocaleDateString();
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';

    let parsedVal = val;
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try {
            parsedVal = JSON.parse(val);
        } catch (e) {}
    }

    if (Array.isArray(parsedVal)) {
        return parsedVal.map(v => formatGraphValue(v)).join(' | ');
    }
    if (typeof parsedVal === 'object') {
        if (isPersonOrContactValue(parsedVal)) {
            return getPersonOrContactSummary(parsedVal);
        }
        if (isAddressValue(parsedVal)) {
            return getAddressSummary(parsedVal);
        }
        if (parsedVal.line1 || parsedVal.city || parsedVal.country) {
            const parts = [parsedVal.line1, parsedVal.line2, parsedVal.city, parsedVal.region, parsedVal.postalCode, parsedVal.country].filter(Boolean);
            return parts.join(', ');
        }
        if (parsedVal.firstName || parsedVal.lastName) {
            const parts = [parsedVal.firstName, parsedVal.middleName, parsedVal.lastName].filter(Boolean);
            const name = parts.join(' ');
            return parsedVal.primaryNationality ? `${name} (${parsedVal.primaryNationality})` : name;
        }
        if (parsedVal.name) return parsedVal.name;
        if (parsedVal.legalName) return parsedVal.legalName;
        if (parsedVal.entityName) return parsedVal.entityName;
        if (parsedVal.fullName) return parsedVal.fullName;
        // Code-list items: { code, label } — e.g. SIC codes
        if (parsedVal.code !== undefined) return parsedVal.label ? `${parsedVal.code} — ${parsedVal.label}` : String(parsedVal.code);
        
        return JSON.stringify(parsedVal);
    }
    if (typeof parsedVal === 'string' && parsedVal.match(/^\d{4}-\d{2}-\d{2}T/)) {
        const d = new Date(parsedVal);
        if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }
    return String(parsedVal);
}

/** Delegates to getSourceDisplayName for a short friendly label (no sourceReference available at call site). */
function friendlySourceLabel(source?: string): string {
    if (!source) return 'Empty';
    return getSourceDisplayName(source, null);
}

function ProposalRow({
    proposal,
    isLast,
    onAccept,
    onDismiss,
}: {
    proposal: FieldProposal;
    isLast: boolean;
    onAccept: () => void;
    onDismiss: () => void;
}) {
    const isBlocked = proposal.action === 'BLOCKED';
    const fmt = (val: any) => (val !== undefined && val !== null ? formatGraphValue(val) : '—');

    return (
        <div
            className={cn(
                "grid grid-cols-[2fr_3fr_auto] gap-x-4 items-center px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors",
                !isLast && "border-b border-slate-100"
            )}
        >
            {/* Field name + status */}
            <div className="flex items-center gap-1.5 min-w-0">
                {isBlocked
                    ? <Ban className="h-3 w-3 text-red-400 shrink-0" />
                    : <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />}
                <span className="truncate text-slate-700 font-medium text-xs" title={proposal.fieldName}>
                    {proposal.fieldName}
                </span>
                <Badge variant="outline" className="text-[9px] shrink-0 px-1 py-0 h-4 text-slate-400 border-slate-200">
                    {proposal.fieldNo}
                </Badge>
            </div>

            {/* Current → Proposed */}
            <div className="flex items-center gap-2 min-w-0">
                <span
                    className="truncate text-xs text-slate-500 font-mono"
                    title={fmt(proposal.current?.value)}
                >
                    {fmt(proposal.current?.value)}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                <span
                    className={cn(
                        "truncate text-xs font-mono font-medium",
                        isBlocked ? "text-red-500 line-through" : "text-emerald-700"
                    )}
                    title={fmt(proposal.proposed?.value)}
                >
                    {fmt(proposal.proposed?.value)}
                </span>
                <span className="text-[9px] text-slate-400 shrink-0">
                    via {friendlySourceLabel(proposal.proposed?.source)}
                </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 justify-end">
                {!isBlocked && (
                    <Button
                        size="sm"
                        className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                        onClick={onAccept}
                    >
                        Accept
                    </Button>
                )}
                {isBlocked && (
                    <span className="text-[10px] text-red-400 italic truncate max-w-[120px]" title={proposal.reason}>
                        {proposal.reason}
                    </span>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-slate-600"
                    onClick={onDismiss}
                    title="Remove from this list"
                >
                    ✕
                </Button>
            </div>
        </div>
    );
}
