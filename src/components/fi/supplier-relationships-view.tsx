"use client";

import { useState, useMemo, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Building2,
    Landmark,
    FileText,
    ChevronDown,
    ChevronRight,
    Lock,
    Clock,
    ShieldCheck,
    X,
    ExternalLink,
    AlertCircle
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SupplierClientRelationshipGroup } from "@/actions/fi";
import { usePreferences } from "@/components/providers/user-preferences-provider";

interface SupplierRelationshipsViewProps {
    orgId: string;
    orgName: string;
    relationships: SupplierClientRelationshipGroup[];
    initialExpandedId?: string;
}

function SupplierRelationshipsViewInner({
    orgId,
    orgName,
    relationships,
    initialExpandedId
}: SupplierRelationshipsViewProps) {
    const searchParams = useSearchParams();
    const targetedExpandRelId = initialExpandedId || searchParams.get("expand");
    const { preferences, updatePreference } = usePreferences();

    const [search, setSearch] = useState("");

    // Collapsed nodes preference dictionary:
    // e.g. { "supplier_org-1_client_client-1": false, "supplier_org-1_rel_rel-1": true }
    const collapsedNodesPreference: Record<string, boolean> =
        preferences?.supplierCollapsedTreeNodes || {};

    const handleToggleNode = (nodeKey: string, isCurrentlyOpen: boolean) => {
        const nextState = {
            ...collapsedNodesPreference,
            [nodeKey]: isCurrentlyOpen // if it was open, it's now collapsed (true)
        };
        updatePreference("supplierCollapsedTreeNodes", nextState);
    };

    // Filter hierarchy by search query
    const filteredRelationships = useMemo(() => {
        const query = search.toLowerCase().trim();
        if (!query) return relationships;

        return relationships
            .map((clientGroup) => {
                const matchesClientName = clientGroup.clientOrganizationName.toLowerCase().includes(query);

                const matchingLEs = clientGroup.legalEntities.filter((le) => {
                    const matchesLEName = le.clientLEName.toLowerCase().includes(query);
                    const matchesQuestionnaires = le.questionnaires.some(
                        (q) =>
                            q.name.toLowerCase().includes(query) ||
                            (q.referenceCode && q.referenceCode.toLowerCase().includes(query))
                    );
                    return matchesLEName || matchesQuestionnaires;
                });

                if (matchesClientName || matchingLEs.length > 0) {
                    return {
                        ...clientGroup,
                        legalEntities: matchesClientName ? clientGroup.legalEntities : matchingLEs
                    };
                }
                return null;
            })
            .filter(Boolean) as SupplierClientRelationshipGroup[];
    }, [relationships, search]);

    return (
        <div className="w-full space-y-6 pb-20 p-8">
            {/* Header & Subtitle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-md border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Client Relationships</h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Client Legal Entity relationships available to {orgName}.
                    </p>
                </div>

                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search clients, legal entities or questionnaires..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 pr-9 bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500 text-xs h-10 rounded-lg"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Tree Hierarchy */}
            {filteredRelationships.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-md border border-dashed border-slate-300 p-8 space-y-2">
                    <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-slate-800">
                        {search ? "No Client Relationships found" : "No Client Relationships available"}
                    </h3>
                    <p className="text-slate-500 text-xs">
                        {search
                            ? "Try adjusting your search terms to find Clients, Legal Entities or questionnaires."
                            : "No Client Relationships are currently available for this Supplier."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRelationships.map((clientGroup) => {
                        const clientNodeKey = `supplier_${orgId}_client_${clientGroup.clientOrganizationId}`;

                        // Check if any child matches targeted expand or search query
                        const hasTargetedRel = clientGroup.legalEntities.some(
                            (le) => le.relationshipId === targetedExpandRelId
                        );
                        const isSearching = search.trim().length > 0;

                        // Default: Client cards OPEN unless explicitly set to collapsed (true)
                        const isExplicitlyCollapsed = collapsedNodesPreference[clientNodeKey] === true;
                        const isClientOpen = isSearching || hasTargetedRel || !isExplicitlyCollapsed;

                        return (
                            <Collapsible
                                key={clientGroup.clientOrganizationId}
                                open={isClientOpen}
                                onOpenChange={() => handleToggleNode(clientNodeKey, isClientOpen)}
                                className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden transition-all"
                            >
                                {/* Level 1: Client Card Header */}
                                <div className="p-5 flex items-center justify-between gap-4 bg-slate-50/40 hover:bg-slate-50 transition-colors border-b border-slate-100">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 shrink-0"
                                            >
                                                {isClientOpen ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </CollapsibleTrigger>

                                        <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                                            <Building2 className="h-5 w-5" />
                                        </div>

                                        <div className="min-w-0">
                                            <h2 className="text-base font-bold text-slate-900 truncate">
                                                {clientGroup.clientOrganizationName}
                                            </h2>
                                            <div className="text-xs text-slate-500 font-medium">
                                                {clientGroup.legalEntities.length}{" "}
                                                {clientGroup.legalEntities.length === 1 ? "Legal Entity" : "Legal Entities"}
                                                {clientGroup.questionnaireCount > 0 && (
                                                    <> • {clientGroup.questionnaireCount} {clientGroup.questionnaireCount === 1 ? "questionnaire" : "questionnaires"}</>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Aggregated Question Count Badges (Operational view only) */}
                                    {clientGroup.questionCounts.total > 0 && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge
                                                variant="outline"
                                                className="bg-amber-50 text-amber-800 border-amber-200 text-xs font-semibold px-2.5 py-1"
                                                title="Awaiting Client"
                                            >
                                                <Lock className="h-3 w-3 mr-1 text-amber-600" />
                                                {clientGroup.questionCounts.notShared} awaiting
                                            </Badge>
                                            <Badge
                                                variant="secondary"
                                                className="bg-blue-50 text-blue-800 border-blue-200 text-xs font-semibold px-2.5 py-1"
                                                title="Shared (Provisional)"
                                            >
                                                <Clock className="h-3 w-3 mr-1 text-blue-600" />
                                                {clientGroup.questionCounts.shared} shared
                                            </Badge>
                                            <Badge
                                                className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold px-2.5 py-1"
                                                title="Released (Formal)"
                                            >
                                                <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" />
                                                {clientGroup.questionCounts.released} released
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {/* Level 2: Nested Client Legal Entity Rows */}
                                <CollapsibleContent>
                                    <div className="p-4 space-y-3 bg-slate-50/20">
                                        {clientGroup.legalEntities.map((le) => {
                                            const relNodeKey = `supplier_${orgId}_rel_${le.relationshipId}`;
                                            const isTargetedRel = le.relationshipId === targetedExpandRelId;
                                            const hasQuestionnaires = le.questionnaires.length > 0;

                                            // Default: ClientLE rows COLLAPSED unless explicitly expanded or targeted/searched
                                            const isExplicitlyExpanded = collapsedNodesPreference[relNodeKey] === false;
                                            const isRelOpen =
                                                hasQuestionnaires &&
                                                (isSearching || isTargetedRel || isExplicitlyExpanded);

                                            return (
                                                <Collapsible
                                                    key={le.relationshipId}
                                                    open={isRelOpen}
                                                    onOpenChange={() => handleToggleNode(relNodeKey, isRelOpen)}
                                                    className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden"
                                                >
                                                    {/* ClientLE Row Header */}
                                                    <div
                                                        className={cn(
                                                            "p-4 flex items-center justify-between gap-4 transition-colors",
                                                            isTargetedRel
                                                                ? "bg-teal-50/40 border-l-2 border-l-teal-500"
                                                                : "hover:bg-slate-50/60"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            {hasQuestionnaires ? (
                                                                <CollapsibleTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 shrink-0"
                                                                    >
                                                                        {isRelOpen ? (
                                                                            <ChevronDown className="h-3.5 w-3.5" />
                                                                        ) : (
                                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </Button>
                                                                </CollapsibleTrigger>
                                                            ) : (
                                                                <div className="w-7 shrink-0" />
                                                            )}

                                                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                                                <Landmark className="h-4 w-4" />
                                                            </div>

                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-sm font-bold text-slate-900 truncate">
                                                                        {le.clientLEName}
                                                                    </span>
                                                                    {le.status && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-[10px] uppercase tracking-wider font-extrabold text-slate-600 border-slate-300 bg-slate-50"
                                                                        >
                                                                            {le.status}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                 {le.questionCounts.total > 0 && (
                                                                    <div className="text-[11px] text-slate-500">
                                                                        {le.questionnaires.length}{" "}
                                                                        {le.questionnaires.length === 1 ? "questionnaire" : "questionnaires"} •{" "}
                                                                        {le.questionCounts.notShared} awaiting •{" "}
                                                                        {le.questionCounts.shared} shared •{" "}
                                                                        {le.questionCounts.released} released
                                                                    </div>
                                                                 )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Level 3: Nested Questionnaire Leaf Rows */}
                                                    <CollapsibleContent>
                                                        <div className="border-t border-slate-100 bg-slate-50/50 p-3 pl-12 space-y-2">
                                                            {le.questionnaires.length === 0 ? (
                                                                <div className="py-3 px-4 text-xs text-slate-500 italic">
                                                                    No questionnaires assigned to this Client Legal Entity.
                                                                </div>
                                                            ) : (
                                                                le.questionnaires.map((q) => {
                                                                    const reviewParams = new URLSearchParams({
                                                                        rel: le.clientLEName,
                                                                        q: q.name
                                                                    });
                                                                    const reviewHref = `/app/s/${orgId}/questions?${reviewParams.toString()}`;

                                                                    return (
                                                                        <div
                                                                            key={q.id}
                                                                            className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-4 flex-wrap hover:border-slate-300 transition-all"
                                                                        >
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className="text-xs font-bold text-slate-900 truncate">
                                                                                            {q.name}
                                                                                        </span>
                                                                                        {q.version && (
                                                                                            <Badge
                                                                                                variant="outline"
                                                                                                className="text-[10px] font-bold text-slate-500 border-slate-200 bg-slate-50"
                                                                                            >
                                                                                                v{q.version}
                                                                                            </Badge>
                                                                                        )}
                                                                                        {q.referenceCode && (
                                                                                            <Badge
                                                                                                variant="outline"
                                                                                                className="text-[10px] font-extrabold text-teal-700 border-teal-200 bg-teal-50"
                                                                                            >
                                                                                                {q.referenceCode}
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                                                                                        <span>
                                                                                            {q.questionCounts.total} questions ({q.questionCounts.notShared} awaiting, {q.questionCounts.shared} shared, {q.questionCounts.released} released)
                                                                                        </span>
                                                                                        {q.latestSharedOrReleasedAt && (
                                                                                            <>
                                                                                                <span className="text-slate-300">•</span>
                                                                                                <span>
                                                                                                    Latest activity: {format(new Date(q.latestSharedOrReleasedAt), "dd MMM yyyy")}
                                                                                                </span>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <Link href={reviewHref}>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-8 text-xs font-semibold text-teal-700 border-teal-200 hover:bg-teal-50 hover:text-teal-800 gap-1.5 rounded-lg"
                                                                                >
                                                                                    <span>Review questionnaire</span>
                                                                                    <ExternalLink className="h-3 w-3" />
                                                                                </Button>
                                                                            </Link>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            );
                                        })}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function SupplierRelationshipsView(props: SupplierRelationshipsViewProps) {
    return (
        <Suspense fallback={null}>
            <SupplierRelationshipsViewInner {...props} />
        </Suspense>
    );
}
