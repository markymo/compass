import { getAllQuestionnaires } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

import { CreateManualDialog } from "@/components/admin/create-manual-dialog";

export const dynamic = 'force-dynamic';

export default async function AdminQuestionnairesPage() {
    const questionnaires = await getAllQuestionnaires();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Questionnaire Management</h1>
                    <p className="text-muted-foreground">Review and map questionnaires uploaded by Financial Institutions.</p>
                </div>
                <CreateManualDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Questionnaires</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Mapping</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {questionnaires.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No questionnaires found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                questionnaires.map((q) => (
                                    <TableRow key={q.id}>
                                        <TableCell>
                                            <div className="font-medium">{q.name}</div>
                                            <div className="text-xs text-muted-foreground">{q.fileName}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={q.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                                {q.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {q.mappings ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Mapped</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/app/admin/questionnaires/${q.id}`}>
                                                <Button size="sm" variant="ghost">
                                                    Manage <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </Link>
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
