import { getFIQuestionnaires, getFIOganization } from "@/actions/fi";
import { UploadQuestionnaireDialog } from "@/components/fi/upload-questionnaire-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { isSystemAdmin, getUserOrgRole } from "@/actions/security";
import Link from "next/link";

export default async function FIQuestionnairesPage() {
    const questionnaires = await getFIQuestionnaires();
    const org = await getFIOganization();
    const isAdmin = (await isSystemAdmin()) || (org ? (await getUserOrgRole(org.id)) === "ADMIN" : false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Questionnaires</h1>
                    <p className="text-muted-foreground">Manage your uploaded forms and check mapping status.</p>
                </div>
                <UploadQuestionnaireDialog isAdmin={isAdmin} />
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
                                <TableHead className="text-right">Actions</TableHead>
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
                                            <div className="flex justify-end gap-2">
                                                {isAdmin && (
                                                    <Link href={`/app/admin/questionnaires/${q.id}`}>
                                                        <Button size="sm" variant="ghost">
                                                            Manage <ArrowRight className="ml-2 h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                )}
                                                <span className="text-xs text-muted-foreground flex items-center px-3">
                                                    {new Date(q.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
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
