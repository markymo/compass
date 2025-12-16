import { getFIQuestionnaires } from "@/actions/fi";
import { UploadQuestionnaireDialog } from "@/components/fi/upload-questionnaire-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default async function FIQuestionnairesPage() {
    const questionnaires = await getFIQuestionnaires();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Questionnaires</h1>
                    <p className="text-muted-foreground">Manage your uploaded forms and check mapping status.</p>
                </div>
                <UploadQuestionnaireDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Uploaded Forms</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Mapping Status</TableHead>
                                <TableHead className="text-right">Uploaded</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {questionnaires.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No questionnaires uploaded yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                questionnaires.map((q) => (
                                    <TableRow key={q.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-blue-500" />
                                                {q.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground ml-6">{q.fileName}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={q.status === "ACTIVE" ? "default" : "secondary"}>
                                                {q.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {/* Logic for mapping status: check if mappings json exists */}
                                                {q.mappings ? (
                                                    <>
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                        <span className="text-sm">Mapped</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Clock className="h-4 w-4 text-amber-500" />
                                                        <span className="text-sm">Pending Mapping</span>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {new Date(q.createdAt).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
