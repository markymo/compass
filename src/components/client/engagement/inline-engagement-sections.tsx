"use client";

import { useEffect, useState } from "react";
import { EngagementDocumentManager } from "./engagement-document-manager";
import { OutputPackBuilder } from "./output-pack-builder";
import { EngagementTeamManager } from "./engagement-team-manager";
import { getEngagementDocuments, getEngagementTeam } from "@/actions/client-le";
import { Loader2 } from "lucide-react";

// --- Inline Document Manager ---
export function InlineDocumentManager({ engagementId }: { engagementId: string }) {
    const [data, setData] = useState<{ sharedDocuments: any[], evidenceDocuments: any[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        getEngagementDocuments(engagementId).then((res) => {
            if (!mounted) return;
            if (res.success) {
                setData({
                    sharedDocuments: res.sharedDocuments || [],
                    evidenceDocuments: res.evidenceDocuments || []
                });
            } else {
                setError(res.error || "Failed to load documents");
            }
        });
        return () => { mounted = false; };
    }, [engagementId]);

    if (error) {
        return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="px-4 py-4 bg-white/50 border-t border-slate-100">
            <EngagementDocumentManager 
                engagementId={engagementId} 
                documents={data.sharedDocuments} 
                evidenceDocuments={data.evidenceDocuments} 
            />
        </div>
    );
}

// --- Inline Output Builder ---
export function InlineOutputBuilder({ 
    engagementId, 
    questionnaires 
}: { 
    engagementId: string, 
    questionnaires: any[] 
}) {
    const [data, setData] = useState<{ sharedDocuments: any[], evidenceDocuments: any[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        getEngagementDocuments(engagementId).then((res) => {
            if (!mounted) return;
            if (res.success) {
                setData({
                    sharedDocuments: res.sharedDocuments || [],
                    evidenceDocuments: res.evidenceDocuments || []
                });
            } else {
                setError(res.error || "Failed to load output pack data");
            }
        });
        return () => { mounted = false; };
    }, [engagementId]);

    if (error) {
        return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="px-4 py-4 bg-white/50 border-t border-slate-100">
            <OutputPackBuilder 
                engagementId={engagementId} 
                questionnaires={questionnaires}
                evidenceDocuments={data.evidenceDocuments}
                sharedDocuments={data.sharedDocuments}
            />
        </div>
    );
}

// --- Inline Team Manager ---
export function InlineTeamManager({ engagementId, orgName }: { engagementId: string, orgName: string }) {
    const [data, setData] = useState<{ members: any[], invitations: any[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        getEngagementTeam(engagementId).then((res) => {
            if (!mounted) return;
            if (res.success) {
                setData({
                    members: res.members || [],
                    invitations: res.invitations || []
                });
            } else {
                setError(res.error || "Failed to load team data");
            }
        });
        return () => { mounted = false; };
    }, [engagementId]);

    if (error) {
        return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="px-4 py-4 bg-white/50 border-t border-slate-100">
            <EngagementTeamManager 
                engagementId={engagementId} 
                orgName={orgName}
                members={data.members} 
                invitations={data.invitations} 
            />
        </div>
    );
}
