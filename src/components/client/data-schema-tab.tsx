"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, RefreshCcw, ArrowRight, ShieldCheck, ShieldAlert, Ban, Info, Building2, FileText, Users, Globe, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { refreshGleifProposals, acceptProposal } from "@/actions/kyc-proposals";
import { refreshRegistryReferenceAction } from "@/actions/registry";
import { FieldProposal, ProvenanceSource } from "@/domain/kyc/types/ProposalTypes";
import { cn } from "@/lib/utils";
import { FieldDetailPanel } from "./inspection/field-detail-panel";
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
    masterData: Record<number, { value: any; source?: string; sourceReference?: string }>;
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
}

export function DataSchemaTab({ leId, masterData, customData = {}, customDefinitions = [], gleifLastSynced, masterFields = [], masterGroups = [], categories = [], uncategorizedFields = [], nationalRegistryData }: DataSchemaTabProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [proposals, setProposals] = useState<FieldProposal[] | null>(null);
    const [selectedField, setSelectedField] = useState<{ fieldNo: number; name: string; customFieldId?: string } | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>(gleifLastSynced);
    const [isRefreshingRegistry, setIsRefreshingRegistry] = useState(false);

    const [search, setSearch] = useState("");
    const [catFilter, setCatFilter] = useState("ALL");
    const [popFilter, setPopFilter] = useState("ALL");

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
                    (f.notes && f.notes.toLowerCase().includes(search.toLowerCase()));
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
                (f.notes && f.notes.toLowerCase().includes(search.toLowerCase()));
            const matchesPop = popFilter === "ALL" || (popFilter === "POPULATED" ? hasValue : !hasValue);

            return matchesSearch && matchesPop;
        });
    }, [uncategorizedFields, masterData, search, catFilter, popFilter]);

    const totalVisible = filteredCustomFields.length + filteredCategories.reduce((acc: any, c: any) => acc + c.fields.length, 0) + filteredUncategorized.length;


    const handleRefreshGleif = async () => {
        setIsRefreshing(true);
        try {
            const result = await refreshGleifProposals(leId);
            if (result.success && result.proposals) {
                setProposals(result.proposals);
                if (result.proposals.length === 0) {
                    toast.info("GLEIF data matches current records. No updates proposed.");
                } else {
                    toast.success(`Generated ${result.proposals.length} proposals from GLEIF.`);
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

                {/* Proposals List — shown inline below the bar when triggered */}
                {proposals && (
                    <div className="mt-5 pt-5 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                                Proposals ({proposals.filter((p: any) => p.action !== 'NO_CHANGE').length})
                            </h3>
                            {proposals.length > 0 && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                    {proposals.filter((p: any) => p.action === 'PROPOSE_UPDATE').length} Actionable
                                </Badge>
                            )}
                        </div>

                        {proposals.filter((p: any) => p.action !== 'NO_CHANGE').length === 0 && (
                            <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                                No differences found. Master record is in sync with GLEIF.
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {proposals.filter((p: any) => p.action !== 'NO_CHANGE').map((proposal: any) => (
                                <ProposalCard
                                    key={proposal.fieldNo}
                                    proposal={proposal}
                                    onAccept={() => handleAccept(proposal)}
                                />
                            ))}
                        </div>
                    </div>
                )}
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
                                                description={field.notes}
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
                                            description={field.notes}
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
                legalEntityId={leId}
                fieldNo={selectedField?.fieldNo || 0}
                fieldName={selectedField?.name || ""}
                customFieldId={selectedField?.customFieldId}
            />
        </div>
    );
}

function MasterFieldDisplay({ label, fieldNo, value, source, sourceReference, onClick, description, isCustom }: {
    label: string,
    fieldNo: number,
    value: any,
    source?: ProvenanceSource,
    sourceReference?: string,
    onClick?: () => void,
    description?: string,
    isCustom?: boolean
}) {
    const hasValue = value !== null && value !== undefined && value !== "";

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
                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                        Field {fieldNo}
                    </Badge>
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
                    {hasValue ? displayValue : <span className="text-slate-400 italic">Empty</span>}
                </div>
                {hasValue && (
                    <div className="flex items-center gap-2">
                        {/* If we had meta timestamp, we'd pass it. For now just source if available. */}
                        {source && <SourceBadge source={source} sourceReference={sourceReference} />}
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

function SourceBadge({ source, sourceReference, timestamp }: { source: string, sourceReference?: string, timestamp?: string }) {
    const colorMap: Record<string, string> = {
        'GLEIF': 'bg-orange-100 text-orange-700 border-orange-200',
        'REGISTRATION_AUTHORITY': 'bg-blue-100 text-blue-700 border-blue-200',
        'COMPANIES_HOUSE': 'bg-blue-100 text-blue-700 border-blue-200',
        'NATIONAL_REGISTRY': 'bg-blue-100 text-blue-700 border-blue-200',
        'USER_INPUT': 'bg-purple-100 text-purple-700 border-purple-200',
        'SYSTEM': 'bg-gray-100 text-gray-700 border-gray-200',
        'MASTER_RECORD': 'bg-slate-100 text-slate-700 border-slate-200'
    };

    // Resolve display label for registry authority sources
    let displaySource: string = source;
    if (source === 'REGISTRATION_AUTHORITY' || source === 'COMPANIES_HOUSE' || source === 'NATIONAL_REGISTRY') {
        if (sourceReference === 'GB_COMPANIES_HOUSE' || sourceReference?.includes('COMPANIES_HOUSE')) {
            displaySource = 'Companies House';
        } else if (sourceReference) {
            displaySource = sourceReference.replace(/^[A-Z]{2}_/, '').replace(/_/g, ' ');
        } else {
            displaySource = 'Registry';
        }
    }

    return (
        <Badge variant="outline" className={cn("text-[10px] h-5", colorMap[source] || colorMap['SYSTEM'])}>
            {displaySource}
            {sourceReference && <span className="ml-1 opacity-50">· {sourceReference}</span>}
            {timestamp && <span className="ml-1 opacity-50">· {new Date(timestamp).toLocaleDateString()}</span>}
        </Badge>
    );
}

export function formatGraphValue(val: any): string {
    if (val === null || val === undefined || val === '') return '';
    if (val instanceof Date) return val.toLocaleDateString();
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (Array.isArray(val)) {
        return val.map(v => formatGraphValue(v)).join(' | ');
    }
    if (typeof val === 'object') {
        if (val.line1 || val.city || val.country) {
            const parts = [val.line1, val.line2, val.city, val.region, val.postalCode, val.country].filter(Boolean);
            return parts.join(', ');
        }
        if (val.firstName || val.lastName) {
            const parts = [val.firstName, val.middleName, val.lastName].filter(Boolean);
            const name = parts.join(' ');
            return val.primaryNationality ? `${name} (${val.primaryNationality})` : name;
        }
        return JSON.stringify(val);
    }
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }
    return String(val);
}

function ProposalCard({ proposal, onAccept }: { proposal: FieldProposal, onAccept: () => void }) {
    const isBlocked = proposal.action === 'BLOCKED';
    const isNoChange = proposal.action === 'NO_CHANGE';

    if (isNoChange) return null;

    const formatValue = (val: any) => val ? formatGraphValue(val) : '-';

    return (
        <Card className={cn(
            "border-l-4",
            isBlocked ? "border-l-red-400" : "border-l-green-500"
        )}>
            <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                            {proposal.fieldName}
                            <Badge variant="outline" className="text-[10px]">Field {proposal.fieldNo}</Badge>
                        </div>
                        {isBlocked && (
                            <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                <Ban className="h-3 w-3" />
                                {proposal.reason}
                            </div>
                        )}
                        {!isBlocked && (
                            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                Review Proposed Update
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm mb-4">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                        <div className="text-[10px] text-slate-400 mb-1">CURRENT ({proposal.current?.source || 'EMPTY'})</div>
                        <div className="font-mono truncate" title={String(proposal.current?.value)}>{formatValue(proposal.current?.value)}</div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-slate-300" />

                    <div className="bg-green-50 p-2 rounded border border-green-100">
                        <div className="text-[10px] text-green-600 mb-1">PROPOSED ({proposal.proposed?.source})</div>
                        <div className="font-mono font-medium truncate" title={String(proposal.proposed?.value)}>{formatValue(proposal.proposed?.value)}</div>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">
                        Dismiss
                    </Button>
                    {!isBlocked && (
                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={onAccept}>
                            Accept Update
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
