"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Building2,
    Search,
    ChevronDown,
    ChevronRight,
    FileText,
    Clock,
    Lock,
    ShieldCheck,
    ArrowRight,
    HelpCircle
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { SupplierRelationshipSummary } from "@/actions/fi";
import { usePreferences } from "@/components/providers/user-preferences-provider";

interface SupplierRelationshipsViewProps {
    orgId: string;
    orgName: string;
    relationships: SupplierRelationshipSummary[];
    initialExpandedId?: string | null;
}

export function SupplierRelationshipsView({
    orgId,
    orgName,
    relationships,
    initialExpandedId
}: SupplierRelationshipsViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const { preferences, updatePreference } = usePreferences();

    // Local override state for initialExpandedId from deep-link query parameter
    const [urlExpandedState, setUrlExpandedState] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (initialExpandedId && relationships.some((r) => r.id === initialExpandedId)) {
            setUrlExpandedState((prev) => ({ ...prev, [initialExpandedId]: true }));
        }
    }, [initialExpandedId, relationships]);

    const filteredRelationships = useMemo(() => {
        if (!searchQuery.trim()) return relationships;

        const q = searchQuery.toLowerCase().trim();
        return relationships.filter((rel) => {
            const leName = (rel.clientLEName || "").toLowerCase();
            const clientOrg = (rel.clientOrganizationName || "").toLowerCase();
            const matchesRelationship = leName.includes(q) || clientOrg.includes(q);

            const matchesQuestionnaire = rel.questionnaires.some((qItem) =>
                (qItem.name || "").toLowerCase().includes(q) ||
                (qItem.referenceCode || "").toLowerCase().includes(q)
            );

            return matchesRelationship || matchesQuestionnaire;
        });
    }, [relationships, searchQuery]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 p-8 w-full">
            {/* Header & Subtitle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Relationships</h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Client Legal Entity relationships available to {orgName}.
                    </p>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search clients or questionnaires..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500 text-xs"
                    />
                </div>
            </div>

            {/* Expandable Relationship Cards List */}
            <div className="space-y-4">
                {filteredRelationships.map((rel) => {
                    const nodeKey = `supplier_${orgId}_rel_${rel.id}`;

                    // Evaluate expanded state via preferences, with initialExpandedId override support
                    const persistedCollapsed = preferences.homePage?.collapsedTreeNodes?.[nodeKey];
                    const isUrlExpanded = urlExpandedState[rel.id] === true;

                    // If URL explicitly requests expansion, open it; otherwise use preferences (default open if not collapsed)
                    const isOpen = isUrlExpanded ? true : !(persistedCollapsed ?? false);

                    const handleOpenChange = (open: boolean) => {
                        if (isUrlExpanded) {
                            setUrlExpandedState((prev) => ({ ...prev, [rel.id]: open }));
                        }
                        const newCollapsed = !open;
                        const currentCollapsedNodes = preferences.homePage?.collapsedTreeNodes || {};

                        updatePreference("homePage", {
                            collapsedTreeNodes: {
                                ...currentCollapsedNodes,
                                [nodeKey]: newCollapsed
                            }
                        });
                    };

                    const { total, notShared, shared, released } = rel.questionCounts;

                    return (
                        <Card key={rel.id} className="border-slate-200 shadow-sm transition-all bg-white overflow-hidden">
                            <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
                                <CardHeader className="p-5 hover:bg-slate-50/60 transition-colors">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" size="sm" className="p-1 h-8 w-8 hover:bg-slate-200/60 rounded-lg">
                                                    {isOpen ? (
                                                        <ChevronDown className="h-5 w-5 text-slate-500" />
                                                    ) : (
                                                        <ChevronRight className="h-5 w-5 text-slate-500" />
                                                    )}
                                                </Button>
                                            </CollapsibleTrigger>

                                            <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                                                <Building2 className="h-5 w-5" />
                                            </div>

                                            <div className="min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <CardTitle className="text-base font-bold text-slate-900 truncate">
                                                        {rel.clientLEName}
                                                    </CardTitle>
                                                    {rel.status && (
                                                        <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-600 border-slate-200">
                                                            {rel.status}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {rel.clientOrganizationName && (
                                                    <CardDescription className="text-xs text-slate-500 font-medium">
                                                        {rel.clientOrganizationName}
                                                    </CardDescription>
                                                )}
                                            </div>
                                        </div>

                                        {/* Summary Stats Pill (Awaiting Client, Shared, Released) */}
                                        <div className="flex items-center gap-3 text-xs text-slate-600 font-medium bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
                                            <div className="flex items-center gap-1.5" title="Associated Questionnaires">
                                                <FileText className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{rel.questionnaires.length} {rel.questionnaires.length === 1 ? "questionnaire" : "questionnaires"}</span>
                                            </div>
                                            <span className="text-slate-300">•</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-700 font-semibold">{notShared} awaiting Client</span>
                                                <span className="text-slate-300">·</span>
                                                <span className="text-blue-700 font-semibold">{shared} shared</span>
                                                <span className="text-slate-300">·</span>
                                                <span className="text-emerald-700 font-semibold">{released} released</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CollapsibleContent>
                                    <CardContent className="pt-0 pb-5 px-5 bg-slate-50/40 border-t border-slate-100">
                                        {rel.questionnaires.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic py-6 text-center border border-dashed border-slate-200 rounded-xl bg-white mt-4">
                                                No questionnaires assigned to this Relationship.
                                            </div>
                                        ) : (
                                            <div className="space-y-3 mt-4">
                                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pl-1">
                                                    Assigned Questionnaires ({rel.questionnaires.length})
                                                </div>

                                                <div className="space-y-2">
                                                    {rel.questionnaires.map((q) => {
                                                        const qCounts = q.questionCounts;
                                                        return (
                                                            <div
                                                                key={q.id}
                                                                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                                                            >
                                                                <div className="space-y-1.5 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-sm font-bold text-slate-900 truncate">
                                                                            {q.name}
                                                                        </span>
                                                                        {q.version && (
                                                                            <Badge variant="outline" className="text-[10px] font-medium border-slate-200 text-slate-500">
                                                                                v{q.version}
                                                                            </Badge>
                                                                        )}
                                                                        {q.referenceCode && (
                                                                            <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-500">
                                                                                {q.referenceCode}
                                                                            </Badge>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                                                        <span>
                                                                            <strong className="text-slate-700">{qCounts.total}</strong> total questions
                                                                        </span>
                                                                        <span className="text-slate-300">•</span>
                                                                        <span className="text-amber-700 font-medium">
                                                                            {qCounts.notShared} awaiting Client
                                                                        </span>
                                                                        <span className="text-slate-300">•</span>
                                                                        <span className="text-blue-700 font-medium">
                                                                            {qCounts.shared} shared
                                                                        </span>
                                                                        <span className="text-slate-300">•</span>
                                                                        <span className="text-emerald-700 font-medium">
                                                                            {qCounts.released} released
                                                                        </span>

                                                                        {q.latestSharedOrReleasedAt && (
                                                                            <>
                                                                                <span className="text-slate-300">•</span>
                                                                                <span className="text-slate-400 text-[11px]">
                                                                                    Updated {format(new Date(q.latestSharedOrReleasedAt), "dd MMM yyyy")}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <Link
                                                                    href={`/app/s/${orgId}/engagements/${rel.id}/workbench/${q.questionnaireId}`}
                                                                    className="shrink-0"
                                                                >
                                                                    <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white text-xs gap-1.5 shadow-sm">
                                                                        Review questionnaire <ArrowRight className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </Link>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </CollapsibleContent>
                            </Collapsible>
                        </Card>
                    );
                })}

                {filteredRelationships.length === 0 && (
                    <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-2">
                        <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                        <h3 className="text-base font-bold text-slate-800">No relationships found</h3>
                        <p className="text-slate-500 text-xs">
                            No Client Legal Entity relationships match your current search query.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
