"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQuestionnaireById, extractDetailedContent, toggleQuestionnaireStatus, deleteQuestionnaire } from "@/actions/questionnaire";
import { getMasterSchemaFields as getFields } from "@/actions/schema-utils";
import { Loader2, Download, Play, Save, ArrowLeft, FileText, Trash2, Archive, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExtractedItem } from "@/actions/ai-mapper";

export default function ManageQuestionnairePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [questionnaire, setQuestionnaire] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [extracting, setExtracting] = useState(false);
    const [masterFields, setMasterFields] = useState<any[]>([]);

    // State for the Grid
    const [items, setItems] = useState<ExtractedItem[]>([]);

    useEffect(() => {
        loadData();
    }, [id]);

    async function loadData() {
        setLoading(true);
        const [q, fields] = await Promise.all([
            getQuestionnaireById(id),
            getFields()
        ]);
        setQuestionnaire(q);
        setMasterFields(fields);

        // Type cast to bypass stale Prisma Client types in check
        const qAny = q as any;
        if (qAny.extractedContent) {
            setItems(qAny.extractedContent as unknown as ExtractedItem[]);
        }

        setLoading(false);
    }

    async function handleExtract() {
        if (!confirm("This will re-analyze the document and overwrite existing extraction data. Continue?")) return;

        setExtracting(true);
        const res = await extractDetailedContent(id);
        setExtracting(false);

        if (res.success) {
            if (res.count === 0) {
                alert("Extraction finished but found 0 items. The document might be empty or unreadable.");
            }
            loadData();
        } else {
            alert("Extraction failed: " + (res.error || "Unknown Error"));
        }
    }

    async function handleArchive() {
        if (!confirm("Archive this questionnaire? It will be hidden from active lists but data preserved.")) return;
        setLoading(true);
        await toggleQuestionnaireStatus(id, "ARCHIVED");
        await loadData();
        setLoading(false);
    }

    async function handleRestore() {
        if (!confirm("Restore this questionnaire to Active status?")) return;
        setLoading(true);
        await toggleQuestionnaireStatus(id, "ACTIVE");
        await loadData();
        setLoading(false);
    }

    async function handleDelete() {
        if (!confirm("PERMANENTLY DELETE this questionnaire? This action cannot be undone.")) return;
        setLoading(true);
        const res = await deleteQuestionnaire(id);
        if (res.success) {
            router.push(`/app/admin/organizations/${questionnaire.fiOrgId}`);
        } else {
            alert("Delete failed: " + res.error);
            setLoading(false);
        }
    }


    function handleItemUpdate(index: number, field: "neutralText" | "masterKey", value: string) {
        const newItems = [...items];
        if (field === "neutralText") {
            newItems[index].neutralText = value;
        } else if (field === "masterKey") {
            newItems[index].masterKey = value === "IGNORE" ? undefined : value;
        }
        setItems(newItems);
    }

    async function handleSave() {
        setLoading(true);
        // We save the items as is. We could also construct the "mappings" object here if we wanted deeper separation.
        // For now, let's assuming saveQuestionnaireChanges handles items.

        try {
            const { saveQuestionnaireChanges } = await import("@/actions/questionnaire");
            const res = await saveQuestionnaireChanges(id, items);
            if (res.success) {
                alert("Changes saved successfully!");
            } else {
                alert("Failed to save changes.");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving changes");
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!questionnaire) return <div>Questionnaire not found</div>;

    const isDraft = questionnaire.status === "DRAFT";
    const isArchived = questionnaire.status === "ARCHIVED";

    return (
        <div className="space-y-6 pb-20">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/app/admin/organizations/${questionnaire.fiOrgId}`}>
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            {questionnaire.name}
                            <Badge variant={isArchived ? "destructive" : "default"}>{questionnaire.status}</Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {questionnaire.fiOrg.name} • {questionnaire.fileName}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* Lifecycle Actions */}
                    {isDraft && (
                        <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                        </Button>
                    )}

                    {!isDraft && !isArchived && (
                        <Button variant="secondary" onClick={handleArchive} disabled={loading}>
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                        </Button>
                    )}

                    {isArchived && (
                        <Button variant="outline" onClick={handleRestore} disabled={loading}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restore
                        </Button>
                    )}


                    {/* Download Button */}
                    <a href={`/api/questionnaires/${id}/download`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Original
                        </Button>
                    </a>

                    {!isArchived && (
                        <>
                            <Button onClick={handleExtract} disabled={extracting}>
                                {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Run Extraction
                            </Button>
                            <Button variant="default" onClick={handleSave} disabled={loading}>
                                <Save className="w-4 h-4 mr-2" />
                                Save
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* EXTRACTION GRID */}
            <Card>
                <CardHeader>
                    <CardTitle>Extraction & Neutralization</CardTitle>
                    <CardDescription>Review the document structure, neutralize questions, and map to master schema.</CardDescription>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No content extracted yet.</p>
                            <p>Click <strong>Run Extraction</strong> to analyze the document.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Type</TableHead>
                                    <TableHead className="w-[30%]">Source (Original)</TableHead>
                                    <TableHead className="w-[30%]">Neutral Version</TableHead>
                                    <TableHead className="w-[20%]">Master Map</TableHead>
                                    <TableHead className="w-[50px]">Conf.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx} className={item.type !== "QUESTION" ? "bg-muted/30" : ""}>
                                        <TableCell>
                                            <Badge variant={item.type === "QUESTION" ? "default" : "secondary"}>
                                                {item.type[0]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="align-top">
                                            <div className="whitespace-pre-wrap text-sm">{item.originalText}</div>
                                            {item.type !== "QUESTION" && <span className="text-xs text-muted-foreground font-mono">{item.type}</span>}
                                        </TableCell>
                                        <TableCell className="align-top">
                                            {item.type === "QUESTION" ? (
                                                <div className="space-y-1">
                                                    <Input
                                                        defaultValue={item.neutralText}
                                                        onChange={(e) => handleItemUpdate(idx, "neutralText", e.target.value)}
                                                        className="h-8 text-sm"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">--</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="align-top">
                                            {item.type === "QUESTION" ? (
                                                <Select
                                                    value={item.masterKey || "IGNORE"}
                                                    onValueChange={(val) => handleItemUpdate(idx, "masterKey", val)}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="IGNORE">-- Ignore --</SelectItem>
                                                        {masterFields.map(f => (
                                                            <SelectItem key={f.key} value={f.key}>
                                                                {f.label} ({f.key})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            {item.confidence && (
                                                <span className={`text-xs font-medium ${item.confidence > 0.8 ? "text-green-600" : "text-yellow-600"
                                                    }`}>
                                                    {(item.confidence * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
