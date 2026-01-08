"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileDown, Plus, History, Clock } from "lucide-react";
import { createVersion, getVersions, getVersionPDF } from "@/actions/versioning";
import { pdf } from "@react-pdf/renderer";
import { QuestionnairePDF } from "@/components/pdf/QuestionnairePDF";
import { format } from "date-fns";

interface VersionHistoryProps {
    questionnaireId: string;
    leId: string;
    questions: any[];
    orgName?: string;
    clientName?: string;
    questionnaireName: string;
}

export function VersionHistory({
    questionnaireId,
    leId,
    questions,
    orgName = "Financial Institution",
    clientName = "Client",
    questionnaireName
}: VersionHistoryProps) {
    const [versions, setVersions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        loadVersions();
    }, [questionnaireId]);

    async function loadVersions() {
        try {
            const res = await getVersions(questionnaireId);
            if (res.success) {
                setVersions(res.data || []);
            }
        } catch (e) {
            console.error("Failed to load versions", e);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateVersion() {
        if (!confirm("This will create a permanent snapshot of the current answers and generate a PDF. Continue?")) return;

        setCreating(true);
        try {
            // 1. Generate PDF blob
            const doc = <QuestionnairePDF
                title={questionnaireName}
                orgName={orgName}
                clientName={clientName}
                questions={questions}
            />;
            const blob = await pdf(doc).toBlob();

            // 2. Convert to base64 for server action
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];

                // 3. Send to server
                const res = await createVersion(questionnaireId, { leId, timestamp: new Date() }, base64data);

                if (res.success) {
                    // Refresh list
                    await loadVersions();
                    // Auto download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${questionnaireName}-v${res.versionNumber}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                } else {
                    alert("Failed to create version: " + res.error);
                }
                setCreating(false);
            };
        } catch (e) {
            console.error(e);
            alert("Error creating version");
            setCreating(false);
        }
    }

    async function handleDownload(v: any) {
        setDownloadingId(v.id);
        try {
            const res = await getVersionPDF(v.id);
            if (res.success && res.pdfBase64) {
                console.log(`[handleDownload] Received base64 length: ${res.pdfBase64.length}`);
                console.log(`[handleDownload] First 100 char: ${res.pdfBase64.substring(0, 100)}`);
                // Clean base64 string
                const cleanBase64 = res.pdfBase64.replace(/[^A-Za-z0-9+/=]/g, "");
                if (cleanBase64.length % 4 !== 0) {
                    console.error(`[handleDownload] Base64 length ${cleanBase64.length} is not multiple of 4`);
                }

                let byteCharacters;
                try {
                    byteCharacters = atob(cleanBase64);
                } catch (e) {
                    console.error("[handleDownload] atob failed on string:", cleanBase64.substring(0, 100) + "...");
                    throw e;
                }

                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/pdf" });

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${questionnaireName}-v${v.versionNumber}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert("Failed to download: " + (res.error || "Unknown error"));
            }
        } catch (e) {
            console.error(e);
            alert("Download failed");
        } finally {
            setDownloadingId(null);
        }
    }

    return (
        <Card className="mt-12 bg-slate-50 border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                            <History className="h-5 w-5 text-indigo-600" />
                            Exports and Responses
                        </CardTitle>
                        <CardDescription>
                            Create permanent snapshots of your responses and download them as PDFs.
                        </CardDescription>
                    </div>
                    <Button
                        onClick={handleCreateVersion}
                        disabled={creating}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
                    >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create New Version
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" /></div>
                ) : versions.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                        No export versions created yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {versions.map((v) => (
                            <div key={v.id} className="flex items-center justify-between p-3 bg-white rounded-md border border-slate-200 hover:border-indigo-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                        V{v.versionNumber}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">
                                            Version {v.versionNumber}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {format(new Date(v.createdAt), "PPP 'at' p")}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownload(v)}
                                    disabled={downloadingId === v.id}
                                    className="gap-2 text-xs"
                                >
                                    {downloadingId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                                    Download PDF
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
