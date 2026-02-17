"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, RefreshCcw, ArrowRight, ShieldCheck, ShieldAlert, Ban, Info, Building2, FileText, Users, Globe, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { refreshGleifProposals, acceptProposal } from "@/actions/kyc-proposals";
import { FieldProposal, ProvenanceSource } from "@/domain/kyc/types/ProposalTypes";
import { cn } from "@/lib/utils";
import { FieldDetailPanel } from "./inspection/field-detail-panel";
import { FIELD_DEFINITIONS, FieldDefinition } from "@/domain/kyc/FieldDefinitions";
import { FIELD_GROUPS } from "@/domain/kyc/FieldGroups";

interface DataSchemaTabProps {
    leId: string;
    masterData: Record<number, { value: any; source?: string }>;
    customData?: Record<string, any>;
    customDefinitions?: any[];
}

export function DataSchemaTab({ leId, masterData, customData = {}, customDefinitions = [] }: DataSchemaTabProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [proposals, setProposals] = useState<FieldProposal[] | null>(null);
    const [selectedField, setSelectedField] = useState<{ fieldNo: number; name: string; customFieldId?: string } | null>(null);

    // Dynamic Grouping Logic
    const groupedFields = useMemo(() => {
        const groups: Record<string, { title: string; icon: any; fields: FieldDefinition[] }> = {};
        const assignedFieldNos = new Set<number>();

        // 1. High Priority Defined Groups (Addresses)
        Object.values(FIELD_GROUPS).forEach(group => {
            groups[group.id] = {
                title: group.label,
                icon: Globe, // Default icon for groups
                fields: []
            };
            group.fieldNos.forEach(fNo => {
                if (FIELD_DEFINITIONS[fNo]) {
                    groups[group.id].fields.push(FIELD_DEFINITIONS[fNo]);
                    assignedFieldNos.add(fNo);
                }
            });
        });

        // 2. Group Remaining Fields by Model
        Object.values(FIELD_DEFINITIONS).forEach(def => {
            if (assignedFieldNos.has(def.fieldNo)) return;
            if (def.isRepeating) return; // Skip repeating fields for now (Stakeholders, etc - explicit handling later)

            const modelKey = def.model || "Other";
            if (!groups[modelKey]) {
                let title = modelKey.replace(/([A-Z])/g, ' $1').trim(); // PascalCase to Title Case
                let icon = FileText;

                if (modelKey === 'IdentityProfile') { icon = Fingerprint; title = "Identity Profile"; }
                if (modelKey === 'ConstitutionalProfile') { icon = Building2; title = "Constitutional Profile"; }
                if (modelKey === 'RelationshipProfile') { icon = Users; title = "Relationship Profile"; }
                if (modelKey === 'LeiRegistration') { icon = ShieldCheck; title = "LEI Registration"; }

                groups[modelKey] = { title, icon, fields: [] };
            }
            groups[modelKey].fields.push(def);
        });

        return groups;
    }, []);

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
        }
    };

    const handleAccept = async (proposal: FieldProposal) => {
        if (!proposal.proposed?.evidenceId) return;

        try {
            const result = await acceptProposal(leId, proposal.fieldNo, proposal.proposed.evidenceId);
            if (result.success) {
                toast.success(`Field ${proposal.fieldNo} updated successfully`);
                setProposals(prev => prev ? prev.filter(p => p.fieldNo !== proposal.fieldNo) : null);
                // Ideally refresh page here or update local state
            } else {
                toast.error(result.message || "Update failed");
            }
        } catch (e) {
            toast.error("An error occurred during acceptance");
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Master Record - Dynamic Groups */}
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Master Record</h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Verified Golden Source record for this entity. Click a field to inspect history.
                    </p>
                </div>

                {/* Custom Fields - Top Priority */}
                {customDefinitions.length > 0 && (
                    <Card className="border-l-4 border-l-purple-500 shadow-sm overflow-hidden">
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
                            {customDefinitions.map((def: any) => {
                                // Value logic: Try by ID (most robust) or Key
                                const value = customData[def.id] || customData[def.key];
                                return (
                                    <MasterFieldDisplay
                                        key={def.id}
                                        label={def.label}
                                        fieldNo={0} // Custom fields don't have standard numbers
                                        value={value?.value || value} // Handle {value, status} or raw value
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

                {Object.entries(groupedFields).map(([key, group]) => {
                    const Icon = group.icon;
                    return (
                        <Card key={key} className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden">
                            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Icon className="h-5 w-5 text-blue-600" />
                                    {group.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                {group.fields.map(field => {
                                    const data = masterData[field.fieldNo];
                                    return (
                                        <MasterFieldDisplay
                                            key={field.fieldNo}
                                            label={field.fieldName}
                                            fieldNo={field.fieldNo}
                                            value={data?.value}
                                            source={data?.source as any}
                                            onClick={() => setSelectedField({ fieldNo: field.fieldNo, name: field.fieldName })}
                                        />
                                    );
                                })}
                                {group.fields.length === 0 && (
                                    <p className="text-sm text-slate-400 italic">No fields in this group.</p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Right Column: Review & Proposals */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">External Sources</h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Compare and accept updates from trusted providers.
                    </p>
                </div>

                {/* Source Control Panel */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                                    GL
                                </div>
                                <div>
                                    <div className="font-medium">Global LEI Index (GLEIF)</div>
                                    <div className="text-xs text-slate-500">Authoritative Source</div>
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
                    </CardContent>
                </Card>

                {/* Proposals List */}
                {proposals && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                                Proposals ({proposals.length})
                            </h3>
                            {proposals.length > 0 && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                    {proposals.filter(p => p.action === 'PROPOSE_UPDATE').length} Actionable
                                </Badge>
                            )}
                        </div>

                        {proposals.length === 0 && (
                            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                                No differences found. Master record is in sync with GLEIF.
                            </div>
                        )}

                        {proposals.map((proposal) => (
                            <ProposalCard
                                key={proposal.fieldNo}
                                proposal={proposal}
                                onAccept={() => handleAccept(proposal)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Inspector Panel */}
            <FieldDetailPanel
                open={!!selectedField}
                onOpenChange={(open) => !open && setSelectedField(null)}
                legalEntityId={leId} // Assuming leId passed is clientLEId, but DetailPanel might need resolving to Real LE. Inspect Panel should handle ClientLEId.
                fieldNo={selectedField?.fieldNo || 0}
                fieldName={selectedField?.name || ""}
                customFieldId={selectedField?.customFieldId}
            />
        </div>
    );
}

function MasterFieldDisplay({ label, fieldNo, value, source, onClick, description, isCustom }: {
    label: string,
    fieldNo: number,
    value: any,
    source?: ProvenanceSource,
    onClick?: () => void,
    description?: string,
    isCustom?: boolean
}) {
    const hasValue = value !== null && value !== undefined && value !== "";

    // Format Value for Display
    let displayValue = value;

    if (hasValue) {
        if (value instanceof Date) {
            displayValue = value.toLocaleDateString();
        } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
        } else if (typeof value === 'object') {
            // Handle JSON/Arrays
            displayValue = JSON.stringify(value);
        } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
            // Handle ISO Strings
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                displayValue = d.toLocaleDateString();
            }
        }
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
                <div className="font-mono text-sm truncate max-w-[200px]" title={String(value)}>
                    {hasValue ? displayValue : <span className="text-slate-400 italic">Empty</span>}
                </div>
                {hasValue && (
                    <div className="flex items-center gap-2">
                        {/* If we had meta timestamp, we'd pass it. For now just source if available. */}
                        {source && <SourceBadge source={source} />}
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

function SourceBadge({ source, timestamp }: { source: ProvenanceSource, timestamp?: string }) {
    const colorMap: Record<string, string> = {
        'GLEIF': 'bg-orange-100 text-orange-700 border-orange-200',
        'COMPANIES_HOUSE': 'bg-blue-100 text-blue-700 border-blue-200',
        'USER_INPUT': 'bg-purple-100 text-purple-700 border-purple-200',
        'SYSTEM': 'bg-gray-100 text-gray-700 border-gray-200',
        'MASTER_RECORD': 'bg-slate-100 text-slate-700 border-slate-200'
    };

    return (
        <Badge variant="outline" className={cn("text-[10px] h-5", colorMap[source] || colorMap['SYSTEM'])}>
            {source}
            {timestamp && <span className="ml-1 opacity-50">· {new Date(timestamp).toLocaleDateString()}</span>}
        </Badge>
    );
}

function ProposalCard({ proposal, onAccept }: { proposal: FieldProposal, onAccept: () => void }) {
    const isBlocked = proposal.action === 'BLOCKED';
    const isNoChange = proposal.action === 'NO_CHANGE';

    if (isNoChange) return null;

    const formatValue = (val: any) => {
        if (val === null || val === undefined) return '-';
        if (val instanceof Date) return val.toLocaleDateString();
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (typeof val === 'object') return JSON.stringify(val);
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toLocaleDateString();
        }
        return String(val);
    };

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
