"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, RefreshCcw, ArrowRight, ShieldCheck, ShieldAlert, Ban, Info } from "lucide-react";
import { toast } from "sonner";
import { refreshGleifProposals, acceptProposal } from "@/actions/kyc-proposals";
import { FieldProposal, ProvenanceSource } from "@/domain/kyc/types/ProposalTypes";
import { cn } from "@/lib/utils";
import { FieldDetailPanel } from "./inspection/field-detail-panel";

interface DataSchemaTabProps {
    leId: string;
    identityProfile: any;
}

export function DataSchemaTab({ leId, identityProfile }: DataSchemaTabProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [proposals, setProposals] = useState<FieldProposal[] | null>(null);
    const [selectedField, setSelectedField] = useState<{ fieldNo: number; name: string } | null>(null);

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
                // Remove accepted proposal from list
                setProposals(prev => prev ? prev.filter(p => p.fieldNo !== proposal.fieldNo) : null);
            } else {
                toast.error(result.message || "Update failed");
            }
        } catch (e) {
            toast.error("An error occurred during acceptance");
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Master Record */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Master Record</h2>
                        <p className="text-slate-500 text-sm mt-1">
                            Current verified data in the Master Schema. Click a field to inspect history.
                        </p>
                    </div>
                </div>

                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Fingerprint className="h-5 w-5 text-blue-600" />
                            Identity Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {/* Iterate over known identity fields */}
                        {/* We manually list them or map them. For now, manual listing for layout control */}

                        <MasterFieldDisplay
                            label="LEI Code"
                            fieldNo={2}
                            value={identityProfile?.leiCode}
                            meta={identityProfile?.meta?.leiCode}
                            onClick={() => setSelectedField({ fieldNo: 2, name: "LEI Code" })}
                        />
                        <MasterFieldDisplay
                            label="Legal Name"
                            fieldNo={3}
                            value={identityProfile?.legalName}
                            meta={identityProfile?.meta?.legalName}
                            onClick={() => setSelectedField({ fieldNo: 3, name: "Legal Name" })}
                        />
                        <MasterFieldDisplay
                            label="Legal Form"
                            fieldNo={26} // Entity Status / Form
                            value={identityProfile?.entityStatus}
                            meta={identityProfile?.meta?.entityStatus}
                            onClick={() => setSelectedField({ fieldNo: 26, name: "Legal Form" })}
                        />
                        <MasterFieldDisplay
                            label="Entity Creation Date"
                            fieldNo={27}
                            value={identityProfile?.entityCreationDate ? new Date(identityProfile.entityCreationDate).toLocaleDateString() : null}
                            meta={identityProfile?.meta?.entityCreationDate}
                            onClick={() => setSelectedField({ fieldNo: 27, name: "Entity Creation Date" })}
                        />
                        <MasterFieldDisplay
                            label="Registered Address"
                            fieldNo={6}
                            value={identityProfile?.regAddressLine1}
                            meta={identityProfile?.meta?.regAddressLine1}
                            onClick={() => setSelectedField({ fieldNo: 6, name: "Registered Address" })}
                        />
                        <MasterFieldDisplay
                            label="City"
                            fieldNo={7}
                            value={identityProfile?.regAddressCity}
                            meta={identityProfile?.meta?.regAddressCity}
                            onClick={() => setSelectedField({ fieldNo: 7, name: "City" })}
                        />
                        <MasterFieldDisplay
                            label="Country"
                            fieldNo={9}
                            value={identityProfile?.regAddressCountry}
                            meta={identityProfile?.meta?.regAddressCountry}
                            onClick={() => setSelectedField({ fieldNo: 9, name: "Country" })}
                        />

                    </CardContent>
                </Card>
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
                legalEntityId={identityProfile?.legalEntityId || ""} // Ensure we pass LegalEntity ID
                fieldNo={selectedField?.fieldNo || 0}
                fieldName={selectedField?.name || ""}
            />
        </div>
    );
}

function MasterFieldDisplay({ label, fieldNo, value, meta, onClick }: { label: string, fieldNo: number, value: any, meta: any, onClick?: () => void }) {
    const hasValue = value !== null && value !== undefined && value !== "";

    return (
        <div
            className={cn("group transition-all duration-200", onClick && "cursor-pointer hover:translate-x-1")}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-1">
                <label className={cn("text-sm font-medium text-slate-700", onClick && "group-hover:text-blue-600 transition-colors")}>{label}</label>
                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                    Field {fieldNo}
                </Badge>
            </div>

            <div className={cn(
                "flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100 transition-all",
                onClick && "group-hover:border-blue-200 group-hover:bg-white group-hover:shadow-sm"
            )}>
                <div className="font-mono text-sm truncate max-w-[200px]" title={String(value)}>
                    {hasValue ? value : <span className="text-slate-400 italic">Empty</span>}
                </div>
                {hasValue && meta && (
                    <SourceBadge source={meta.source} timestamp={meta.timestamp} />
                )}
                {!hasValue && (
                    <div className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 flex items-center gap-1 transition-opacity">
                        <Info className="h-3 w-3" /> Inspect
                    </div>
                )}
            </div>
        </div>
    );
}

function SourceBadge({ source, timestamp }: { source: ProvenanceSource, timestamp?: string }) {
    const colorMap: Record<ProvenanceSource, string> = {
        'GLEIF': 'bg-orange-100 text-orange-700 border-orange-200',
        'COMPANIES_HOUSE': 'bg-blue-100 text-blue-700 border-blue-200',
        'USER_INPUT': 'bg-purple-100 text-purple-700 border-purple-200',
        'SYSTEM': 'bg-gray-100 text-gray-700 border-gray-200'
    };

    return (
        <Badge variant="outline" className={cn("text-[10px] h-5", colorMap[source])}>
            {source}
            {timestamp && <span className="ml-1 opacity-50">· {new Date(timestamp).toLocaleDateString()}</span>}
        </Badge>
    );
}

function ProposalCard({ proposal, onAccept }: { proposal: FieldProposal, onAccept: () => void }) {
    const isBlocked = proposal.action === 'BLOCKED';
    const isNoChange = proposal.action === 'NO_CHANGE';

    // If NO_CHANGE, we might decide not to render it at all in the list to reduce noise, 
    // or render it in a collapsed low-priority way.
    // For now, let's skip NO_CHANGE items unless we want to show everything.
    if (isNoChange) return null;

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
                        <div className="font-mono truncate" title={String(proposal.current?.value)}>{proposal.current?.value || '-'}</div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-slate-300" />

                    <div className="bg-green-50 p-2 rounded border border-green-100">
                        <div className="text-[10px] text-green-600 mb-1">PROPOSED ({proposal.proposed?.source})</div>
                        <div className="font-mono font-medium truncate" title={String(proposal.proposed?.value)}>{proposal.proposed?.value}</div>
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
