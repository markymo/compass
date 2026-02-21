import { getAllQuestionnaires } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, UploadCloud, FileType2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { CreateQuestionnaireWizard } from "@/components/admin/questionnaire/create-questionnaire-wizard";

export const dynamic = 'force-dynamic';

export default async function AdminQuestionnairesPage() {
    const allItems = await getAllQuestionnaires();

    // Source documents are just items with status === "UPLOADED"
    // But we still want to show them in the unified list to give full visibility.
    const sourceDocuments = allItems.filter(q => q.status === "UPLOADED");

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Questionnaire Hub</h1>
                    <p className="text-slate-500 mt-1">Manage all questionnaires, templates, and raw source documents.</p>
                </div>
                <CreateQuestionnaireWizard sourceDocuments={sourceDocuments} />
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 bg-white rounded-t-xl">
                    <CardTitle className="text-lg font-semibold text-slate-800">Unified Directory</CardTitle>
                    <CardDescription>All structured questionnaires and unmapped source documents</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow>
                                <TableHead className="w-[40%]">Name / Source</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Mapping</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-48 text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <FileText className="h-8 w-8 text-slate-300 mb-2" />
                                            <p className="font-medium text-slate-600">No records found.</p>
                                            <p className="text-sm">Click "Create Questionnaire" to get started.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                allItems.map((q) => {
                                    const isSourceDoc = q.status === "UPLOADED";

                                    return (
                                        <TableRow key={q.id} className="hover:bg-slate-50/80 transition-colors">
                                            <TableCell>
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "mt-0.5 p-2 rounded-lg shrink-0",
                                                        isSourceDoc ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                                                    )}>
                                                        {isSourceDoc ? <FileType2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900">{isSourceDoc ? q.fileName : q.name}</div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            {isSourceDoc ? `Uploaded ${formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}` : (q.fileName || "Manual Entry")}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {isSourceDoc ? (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Raw Document</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Questionnaire</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={q.status === 'ACTIVE' ? 'default' : 'secondary'} className={cn(
                                                    "rounded-md font-medium",
                                                    q.status === 'DIGITIZING' && "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
                                                    q.status === 'UPLOADED' && "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                                                )}>
                                                    {q.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {isSourceDoc ? (
                                                    <span className="text-slate-400 text-sm">—</span>
                                                ) : q.mappings ? (
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">Mapped</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 capitalize">Pending</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isSourceDoc ? (
                                                    q.fileUrl && (
                                                        <Button variant="ghost" size="sm" asChild className="hover:bg-blue-50 hover:text-blue-600">
                                                            <a href={q.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                View File
                                                            </a>
                                                        </Button>
                                                    )
                                                ) : (
                                                    <Link href={`/app/admin/questionnaires/${q.id}`}>
                                                        <Button size="sm" variant="ghost" className="hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                                            Manage <ArrowRight className="ml-2 h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

// Utility for classNames (simple fallback if we don't import cn from lib/utils)
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
