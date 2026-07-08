"use client";

import { useState, useMemo, useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Fingerprint, RefreshCcw, ArrowRight, ShieldCheck, Ban, Info, Building2, FileText, Users, Sparkles, ChevronDown, ChevronUp, Clock, ClipboardList, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { refreshGleifProposals } from "@/actions/kyc-proposals";
import { refreshRegistryReferenceAction } from "@/actions/registry";
import { FieldProposal, ProvenanceSource } from "@/domain/kyc/types/ProposalTypes";
import { cn } from "@/lib/utils";
import { getSourceDisplayName } from "@/lib/source-display";
import { FieldDetailPanel } from "./inspection/field-detail-panel";
import { PersonOrContactValueViewer } from "./fields/PersonOrContactValueViewer";
import { FieldSourceBadge } from "./fields/FieldSourceBadge";
import { FieldValueRenderer } from "./fields/FieldValueRenderer";
import { FieldDisplayModel } from "@/lib/master-data/field-display-model";
import { isAddressValue, getAddressSummary } from "@/lib/master-data/address-value";
import { ExpandableText } from "@/components/ui/expandable-text";
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
        formattedDisplayValue?: string;
        mappingStats?: { questions: number; questionnaires: number; suppliers: number };
        canonicalDisplayModel?: FieldDisplayModel;
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
    const [updateNotices, setUpdateNotices] = useState<FieldProposal[] | null>(null);
    const [selectedField, setSelectedField] = useState<{ fieldNo: number; name: string; customFieldId?: string; mappingStats?: { questions: number; questionnaires: number; suppliers: number } } | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(gleifLastSynced);
    const [isRefreshingRegistry, setIsRefreshingRegistry] = useState(false);
    const [noticesExpanded, setNoticesExpanded] = useState(false);
    const [autoCollapseProgress, setAutoCollapseProgress] = useState(100); // 100→0 over 6s
    const collapseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    const [search, setSearch] = useState(searchParams.get("search") || "");
    const catFilter = searchParams.get("category") || "ALL";
    const popFilter = searchParams.get("status") || "ALL";
    const usageFilter = searchParams.get("usage") || "ALL";
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    // Sync search input to URL with debounce
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== (searchParams.get("search") || "")) {
                const params = new URLSearchParams(searchParams.toString());
                if (search) params.set("search", search);
                else params.delete("search");
                startTransition(() => {
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                });
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [search, searchParams, pathname, router]);

    const updateQuery = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== "ALL") params.set(key, value);
        else params.delete(key);
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        });
    };

    const toggleCategory = (id: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => setCollapsedCategories(new Set());
    const collapseAll = () => {
        const allIds = ["CUSTOM", "UNCATEGORIZED", ...categoryList.map((c: any) => c.id)];
        setCollapsedCategories(new Set(allIds));
    };

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
            const questionsCount = val?.mappingStats?.questions || 0;
            const matchesUsage = usageFilter === "ALL" || (usageFilter === "USED" ? questionsCount > 0 : questionsCount === 0);

            return matchesSearch && matchesCat && matchesPop && matchesUsage;
        });
    }, [customDefinitions, customData, search, catFilter, popFilter, usageFilter]);

    const filteredCategories = useMemo(() => {
        return categoryList.map((cat: any) => {
            const fields = cat.fields.filter((f: any) => {
                const data = masterData[f.fieldNo];
                const hasValue = data?.value !== null && data?.value !== undefined && data?.value !== "";

                const matchesSearch = f.fieldName.toLowerCase().includes(search.toLowerCase()) ||
                    (f.description && f.description.toLowerCase().includes(search.toLowerCase()));
                const matchesPop = popFilter === "ALL" || (popFilter === "POPULATED" ? hasValue : !hasValue);
                const questionsCount = data?.mappingStats?.questions || 0;
                const matchesUsage = usageFilter === "ALL" || (usageFilter === "USED" ? questionsCount > 0 : questionsCount === 0);

                return matchesSearch && matchesPop && matchesUsage;
            });

            return { ...cat, fields };
        }).filter((cat: any) => {
            const matchesCat = catFilter === "ALL" || catFilter === cat.id;
            return matchesCat && cat.fields.length > 0;
        });
    }, [categoryList, masterData, search, catFilter, popFilter, usageFilter]);

    const filteredUncategorized = useMemo(() => {
        if (catFilter !== "ALL" && catFilter !== "UNCATEGORIZED") return [];

        return uncategorizedFields.filter((f: any) => {
            const data = masterData[f.fieldNo];
            const hasValue = data?.value !== null && data?.value !== undefined && data?.value !== "";

            const matchesSearch = f.fieldName.toLowerCase().includes(search.toLowerCase()) ||
                (f.description && f.description.toLowerCase().includes(search.toLowerCase()));
            const matchesPop = popFilter === "ALL" || (popFilter === "POPULATED" ? hasValue : !hasValue);
            const questionsCount = data?.mappingStats?.questions || 0;
            const matchesUsage = usageFilter === "ALL" || (usageFilter === "USED" ? questionsCount > 0 : questionsCount === 0);

            return matchesSearch && matchesPop && matchesUsage;
        });
    }, [uncategorizedFields, masterData, search, catFilter, popFilter, usageFilter]);

    const totalVisible = filteredCustomFields.length + filteredCategories.reduce((acc: any, c: any) => acc + c.fields.length, 0) + filteredUncategorized.length;


    // Auto-collapse timer: when proposals are shown, start a 6s countdown then collapse.
    useEffect(() => {
        if (!updateNotices || updateNotices.filter((p: any) => p.action !== 'NO_CHANGE').length === 0) return;

        // Reset and expand whenever new proposals arrive
        setNoticesExpanded(true);
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
                setNoticesExpanded(false);
            }
        }, TICK_MS);

        return () => {
            if (collapseTimerRef.current) clearInterval(collapseTimerRef.current);
        };
    }, [updateNotices]);

    const handleRefreshGleif = async () => {
        setIsRefreshing(true);
        try {
            const result = await refreshGleifProposals(leId);
            if (result.success && result.proposals) {
                setUpdateNotices(result.proposals);
                if (result.proposals.length === 0) {
                    toast.info("Source data matches current records. No updates found.");
                } else {
                    toast.success(`${result.proposals.filter((p: any) => p.action !== 'NO_CHANGE').length} field update${result.proposals.filter((p: any) => p.action !== 'NO_CHANGE').length === 1 ? '' : 's'} processed from external sources.`);
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
                {updateNotices && (() => {
                    const actionable = updateNotices.filter((p: any) => p.action !== 'NO_CHANGE');
                    const updateCount = actionable.filter((p: any) => p.action === 'PROPOSE_UPDATE' || p.action === 'AUTO_APPLIED').length;
                    const blockedCount = actionable.filter((p: any) => p.action === 'BLOCKED').length;

                    if (actionable.length === 0) return (
                        <div className="mt-5 pt-5 border-t border-slate-100 animate-in fade-in duration-300">
                            <p className="text-sm text-slate-500 text-center py-3">
                                ✓ All fields are in sync — no updates found.
                            </p>
                        </div>
                    );

                    const summaryParts: string[] = [];
                    if (updateCount > 0) summaryParts.push(`${updateCount} field${updateCount === 1 ? '' : 's'} updated from source`);
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
                                    setNoticesExpanded(prev => !prev);
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
                                    {noticesExpanded
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
                            {noticesExpanded && (
                                <div className="mt-3 rounded-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                    {/* Column header */}
                                    <div className="grid grid-cols-[2fr_3fr_auto] gap-x-4 px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Field</span>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Previous → Updated from source</span>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"></span>
                                    </div>
                                    {actionable.map((notice: any, idx: number) => (
                                        <ChangeNoticeRow
                                            key={notice.fieldNo}
                                            notice={notice}
                                            isLast={idx === actionable.length - 1}
                                            onDismiss={() => setUpdateNotices(prev => prev ? prev.filter((p: any) => p.fieldNo !== notice.fieldNo) : null)}
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
                        <div className="flex items-center gap-3 mt-1">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-300 text-xs">•</span>
                            <div className="flex items-center gap-1">
                                <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-all">Expand all</button>
                                <span className="text-slate-300 text-xs px-1">/</span>
                                <button onClick={collapseAll} className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-all">Collapse all</button>
                            </div>
                        </div>
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

                        <Select value={catFilter} onValueChange={(v) => updateQuery("category", v)}>
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

                        <Select value={popFilter} onValueChange={(v) => updateQuery("status", v)}>
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

                        <Select value={usageFilter} onValueChange={(v) => updateQuery("usage", v)}>
                            <SelectTrigger className="w-full md:w-[220px] bg-white border-slate-200">
                                <span className="flex items-center gap-2">
                                    <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                                    <SelectValue placeholder="Usage" />
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All fields</SelectItem>
                                <SelectItem value="USED">Used in questionnaires</SelectItem>
                                <SelectItem value="UNUSED">Not used in questionnaires</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Master Record Content */}
                <div className="space-y-6">
                    {/* Custom Fields */}
                    {filteredCustomFields.length > 0 && (
                        <Card className="border-l-4 border-l-purple-500 shadow-sm overflow-hidden animate-in fade-in duration-300">
                            <CardHeader 
                                className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-purple-50/30 cursor-pointer hover:bg-purple-50/50 transition-colors group/header"
                                onClick={() => toggleCategory("CUSTOM")}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-lg text-purple-900">
                                            <Sparkles className="h-5 w-5 text-purple-600" />
                                            Custom Fields
                                        </CardTitle>
                                        <CardDescription className="text-purple-700/70">
                                            Organization-specific data points
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-3 text-purple-600/70">
                                        <span className="text-sm font-medium hidden sm:inline-block">
                                            {filteredCustomFields.length}{filteredCustomFields.length !== customDefinitions.length ? ` of ${customDefinitions.length}` : ''} fields
                                        </span>
                                        {collapsedCategories.has("CUSTOM") ? <ChevronDown className="h-5 w-5 group-hover/header:text-purple-900 transition-colors" /> : <ChevronUp className="h-5 w-5 group-hover/header:text-purple-900 transition-colors" />}
                                    </div>
                                </div>
                            </CardHeader>
                            {!collapsedCategories.has("CUSTOM") && (
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
                                                customFieldId: def.id,
                                                mappingStats: undefined
                                            })}
                                        />
                                    );
                                })}
                            </CardContent>
                            )}
                        </Card>
                    )}

                    {filteredCategories.map((group: any) => {
                        const Icon = group.icon;
                        return (
                            <Card key={group.id} className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden animate-in fade-in duration-300">
                                <CardHeader 
                                    className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors group/header"
                                    onClick={() => toggleCategory(group.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Icon className="h-5 w-5 text-blue-600" />
                                            {group.displayName}
                                        </CardTitle>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <span className="text-sm font-medium hidden sm:inline-block">
                                                {group.fields.length}{group.fields.length !== (categoryList.find((c: any) => c.id === group.id)?.fields.length || 0) ? ` of ${categoryList.find((c: any) => c.id === group.id)?.fields.length || 0}` : ''} fields
                                            </span>
                                            {collapsedCategories.has(group.id) ? <ChevronDown className="h-5 w-5 group-hover/header:text-slate-800 transition-colors" /> : <ChevronUp className="h-5 w-5 group-hover/header:text-slate-800 transition-colors" />}
                                        </div>
                                    </div>
                                </CardHeader>
                                {!collapsedCategories.has(group.id) && (
                                <CardContent className="pt-6 space-y-4">
                                    {group.fields.map((field: any) => {
                                        const data = masterData[field.fieldNo];
                                        return (
                                            <MasterFieldDisplay
                                                key={field.fieldNo}
                                                label={field.fieldName}
                                                fieldNo={field.fieldNo}
                                                fieldDef={field}
                                                value={data?.value}
                                                formattedDisplayValue={data?.formattedDisplayValue}
                                                source={data?.source as any}
                                                sourceReference={data?.sourceReference}
                                                description={field.description}
                                                registrationAuthorityId={registrationAuthorityId}
                                                groups={fieldGroupMap.get(field.fieldNo)}
                                                displayState={data?.displayState}
                                                defaultResponse={data?.defaultResponse}
                                                mappingStats={data?.mappingStats}
                                                canonicalDisplayModel={data?.canonicalDisplayModel}
                                                onClick={() => setSelectedField({ fieldNo: field.fieldNo, name: field.fieldName, mappingStats: data?.mappingStats })}
                                            />
                                        );
                                    })}
                                </CardContent>
                                )}
                            </Card>
                        );
                    })}

                    {filteredUncategorized.length > 0 && (
                        <Card className="border-l-4 border-l-slate-400 shadow-sm overflow-hidden opacity-80 animate-in fade-in duration-300">
                            <CardHeader 
                                className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors group/header"
                                onClick={() => toggleCategory("UNCATEGORIZED")}
                            >
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <FileText className="h-5 w-5 text-slate-500" />
                                        Uncategorized
                                    </CardTitle>
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <span className="text-sm font-medium hidden sm:inline-block">
                                            {filteredUncategorized.length}{filteredUncategorized.length !== uncategorizedFields.length ? ` of ${uncategorizedFields.length}` : ''} fields
                                        </span>
                                        {collapsedCategories.has("UNCATEGORIZED") ? <ChevronDown className="h-5 w-5 group-hover/header:text-slate-800 transition-colors" /> : <ChevronUp className="h-5 w-5 group-hover/header:text-slate-800 transition-colors" />}
                                    </div>
                                </div>
                            </CardHeader>
                            {!collapsedCategories.has("UNCATEGORIZED") && (
                            <CardContent className="pt-6 space-y-4">
                                {filteredUncategorized.map((field: any) => {
                                    const data = masterData[field.fieldNo];
                                    return (
                                        <MasterFieldDisplay
                                            key={field.fieldNo}
                                            label={field.fieldName}
                                            fieldNo={field.fieldNo}
                                            fieldDef={field}
                                            value={data?.value}
                                            formattedDisplayValue={data?.formattedDisplayValue}
                                            source={data?.source as any}
                                            sourceReference={data?.sourceReference}
                                            description={field.description}
                                            registrationAuthorityId={registrationAuthorityId}
                                            groups={fieldGroupMap.get(field.fieldNo)}
                                            displayState={data?.displayState}
                                            defaultResponse={data?.defaultResponse}
                                            mappingStats={data?.mappingStats}
                                            canonicalDisplayModel={data?.canonicalDisplayModel}
                                            onClick={() => setSelectedField({ fieldNo: field.fieldNo, name: field.fieldName, mappingStats: data?.mappingStats })}
                                        />
                                    );
                                })}
                            </CardContent>
                            )}
                        </Card>
                    )}

                    {totalVisible === 0 && (
                        <div className="py-20 text-center bg-white rounded-xl border border-dashed border-slate-300 animate-in fade-in duration-300">
                            <AlertCircle className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-slate-900">No matching fields</h3>
                            <p className="text-slate-500 mt-1">Try adjusting your filters or search terms.</p>
                            <Button
                                variant="link"
                                onClick={() => { setSearch(""); router.replace(pathname, { scroll: false }); }}
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
                mappingStats={selectedField?.mappingStats}
            />
        </div>
    );
}

function MasterFieldDisplay({ label, fieldNo, value, formattedDisplayValue, source, sourceReference, registrationAuthorityId, onClick, description, isCustom, groups = [], displayState, defaultResponse, mappingStats, fieldDef, canonicalDisplayModel }: {
    label: string,
    fieldNo: number,
    value: any,
    formattedDisplayValue?: string,
    source?: ProvenanceSource,
    sourceReference?: string,
    /** Entity-specific GLEIF RA code — passed to SourceBadge for RA sources only. */
    registrationAuthorityId?: string,
    onClick?: () => void,
    description?: string,
    isCustom?: boolean,
    groups?: { id: string; label: string }[],
    displayState?: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE",
    defaultResponse?: string,
    mappingStats?: { questions: number; questionnaires: number; suppliers: number },
    fieldDef?: any,
    canonicalDisplayModel?: FieldDisplayModel
}) {
    const hasValue = value !== null && value !== undefined && value !== "";
    const resolvedState = displayState || (hasValue ? "HAS_VALUE" : (source ? "CHECKED_NO_DATA" : "UNMAPPED_NO_RESPONSE"));

    let displayValue = value;

    if (hasValue) {
        displayValue = formattedDisplayValue !== undefined ? formattedDisplayValue : formatGraphValue(value);
    }

    const isRepeatingParty = fieldDef?.appDataType === 'PARTY' && fieldDef?.isMultiValue;
    const isArrayValue = Array.isArray(value) && value.length > 0;

    return (
        <div className="group transition-all duration-200">
            <div className="flex items-center justify-between mb-1">
                <div className="flex flex-col">
                    <label className="text-sm font-medium text-slate-700">
                        {label}
                    </label>
                    {description && (
                        <ExpandableText
                            text={description}
                            maxLines={3}
                            textClassName="text-[10px] text-slate-400 italic font-normal"
                        />
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

                        {mappingStats && (
                            <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors cursor-default">
                                            <ClipboardList className="h-3 w-3 mr-1" />
                                            {mappingStats.questions}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs bg-slate-900 text-white border-slate-800">
                                        <p className="font-semibold mb-1">Used by:</p>
                                        <ul className="pl-3 list-disc space-y-0.5 opacity-90">
                                            <li>{mappingStats.questions} question{mappingStats.questions === 1 ? '' : 's'}</li>
                                            <li>{mappingStats.questionnaires} questionnaire{mappingStats.questionnaires === 1 ? '' : 's'}</li>
                                            <li>{mappingStats.suppliers} supplier{mappingStats.suppliers === 1 ? '' : 's'}</li>
                                        </ul>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

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

            <div 
                className={cn(
                    "flex p-3 bg-slate-50 rounded-md border border-slate-100 transition-all w-full",
                    isRepeatingParty && isArrayValue ? "flex-col gap-3" : "items-center justify-between",
                    onClick && "cursor-pointer hover:border-blue-200 hover:bg-white hover:shadow-sm"
                )}
                onClick={onClick}
            >
                {isRepeatingParty && isArrayValue ? (
                    <>
                        <div className="flex justify-between items-start w-full">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{value.length} Items</span>
                            <div className="flex items-center gap-2">
                                {(resolvedState === "HAS_VALUE" || resolvedState === "MAPPED_NOT_CHECKED" || resolvedState === "CHECKED_NO_DATA") && (canonicalDisplayModel?.source || source) && (
                                    <FieldSourceBadge source={canonicalDisplayModel?.source} showLastValidated={true} legacySourceType={source} legacySourceReference={sourceReference} legacyRaId={registrationAuthorityId} />
                                )}
                                {onClick && (
                                    <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                                                    className="p-1 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-200/50 transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                                                    aria-label={`Open details for ${label}`}
                                                    aria-haspopup="dialog"
                                                >
                                                    <PanelRightOpen className="h-4 w-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs bg-slate-900 text-white border-slate-800">
                                                Open details for {label}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                            <div className="flex flex-col w-full divide-y divide-slate-100 border border-slate-200 rounded-md bg-white shadow-sm overflow-hidden">
                                {value.slice(0, 18).map((party: any, idx: number) => {
                                    let parsed = party;
                                    if (typeof party === 'string' && (party.startsWith('{') || party.startsWith('['))) { try { parsed = JSON.parse(party); } catch {} }
                                    const partyVal = parsed.ccParty?.data || parsed._resolvedData?.ccParty?.data || parsed;
                                    return (
                                        <div key={idx} className="px-3 py-2 flex items-center min-h-[48px] min-w-0">
                                            <PersonOrContactValueViewer value={partyVal} layout="row" displayMask={fieldDef?.profileConfig?.displayMask} />
                                        </div>
                                    );
                                })}
                            </div>
                            {value.length > 18 && (
                                <div className="text-[11px] text-slate-500 font-medium mt-1 px-1 flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                                    + {value.length - 18} more — open drawer to review all <ArrowRight className="h-3 w-3" />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="font-mono text-sm line-clamp-2 break-words flex-1 min-w-0" title={typeof value === 'object' && value ? JSON.stringify(value, null, 2) : String(value)}>
                            {(() => {
                                const isSafeCollection = canonicalDisplayModel?.value.kind === 'collection' && 
                                    canonicalDisplayModel.value.items.every(i => 
                                        i.value.kind === 'scalar' || 
                                        i.value.kind === 'empty' || 
                                        i.value.kind === 'party' || 
                                        i.value.kind === 'partyRef' ||
                                        i.value.kind === 'address' ||
                                        i.value.kind === 'addressRef'
                                    );

                                return canonicalDisplayModel && (
                                    canonicalDisplayModel.value.kind === 'scalar' || 
                                    canonicalDisplayModel.value.kind === 'empty' ||
                                    canonicalDisplayModel.value.kind === 'party' ||
                                    canonicalDisplayModel.value.kind === 'partyRef' ||
                                    canonicalDisplayModel.value.kind === 'address' ||
                                    canonicalDisplayModel.value.kind === 'addressRef' ||
                                    canonicalDisplayModel.value.kind === 'codeList' ||
                                    isSafeCollection
                                ) ? (
                                    <FieldValueRenderer field={canonicalDisplayModel} />
                                ) : (
                                <>
                                    {resolvedState === "HAS_VALUE" && (value?.explicitNone ? "None" : displayValue)}
                                    {resolvedState === "MAPPED_NOT_CHECKED" && <span className="text-slate-400 italic">No response recorded</span>}
                                    {resolvedState === "CHECKED_NO_DATA" && <span className="text-slate-800 font-medium">None</span>}
                                    {resolvedState === "DEFAULT_RESPONSE" && (
                                        <span className="flex items-center gap-2 text-blue-600 font-medium">
                                            <span>{defaultResponse}</span>
                                            <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-blue-500 bg-blue-50 border-blue-200">Field Default</Badge>
                                        </span>
                                    )}
                                    {resolvedState === "UNMAPPED_NO_RESPONSE" && <span className="text-slate-400 italic">No response recorded</span>}
                                </>
                                );
                            })()}
                        </div>
                        {(resolvedState === "HAS_VALUE" || resolvedState === "MAPPED_NOT_CHECKED" || resolvedState === "CHECKED_NO_DATA") && (canonicalDisplayModel?.source || source) && (
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                <FieldSourceBadge source={canonicalDisplayModel?.source} showLastValidated={true} legacySourceType={source} legacySourceReference={sourceReference} legacyRaId={registrationAuthorityId} />
                            </div>
                        )}
                        {onClick && (
                            <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onClick(); }}
                                            className="ml-4 p-1.5 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-200/50 transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                                            aria-label={`Open details for ${label}`}
                                            aria-haspopup="dialog"
                                        >
                                            <PanelRightOpen className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs bg-slate-900 text-white border-slate-800">
                                                Open details for {label}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </>
                )}
            </div>
        </div>
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

function ChangeNoticeRow({
    notice,
    isLast,
    onDismiss,
}: {
    notice: FieldProposal;
    isLast: boolean;
    onDismiss: () => void;
}) {
    const isBlocked = notice.action === 'BLOCKED';
    const isApplied = notice.action === 'AUTO_APPLIED' || notice.action === 'PROPOSE_UPDATE';
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
                <span className="truncate text-slate-700 font-medium text-xs" title={notice.fieldName}>
                    {notice.fieldName}
                </span>
                <Badge variant="outline" className="text-[9px] shrink-0 px-1 py-0 h-4 text-slate-400 border-slate-200">
                    {notice.fieldNo}
                </Badge>
            </div>

            {/* Current → Proposed/Applied */}
            <div className="flex items-center gap-2 min-w-0">
                <span
                    className="truncate text-xs text-slate-500 font-mono"
                    title={fmt(notice.current?.value)}
                >
                    {fmt(notice.current?.value)}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                <span
                    className={cn(
                        "truncate text-xs font-mono font-medium",
                        isBlocked ? "text-red-500 line-through" : "text-emerald-700"
                    )}
                    title={fmt(notice.proposed?.value)}
                >
                    {fmt(notice.proposed?.value)}
                </span>
                <span className="text-[9px] text-slate-400 shrink-0">
                    via {friendlySourceLabel(notice.proposed?.source)}
                </span>
            </div>

            {/* Actions / Info */}
            <div className="flex items-center gap-1 justify-end">
                {isApplied && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 truncate max-w-[120px]">
                        Applied
                    </span>
                )}
                {isBlocked && (
                    <span className="text-[10px] text-red-400 italic truncate max-w-[120px]" title={notice.reason}>
                        Blocked: {notice.reason}
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
