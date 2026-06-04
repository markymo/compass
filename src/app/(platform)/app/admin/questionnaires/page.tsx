import { getAllQuestionnaires } from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateQuestionnaireWizard } from "@/components/admin/questionnaire/create-questionnaire-wizard";
import { QuestionnaireIndexList } from "@/components/admin/questionnaire/questionnaire-index-list";

export const dynamic = 'force-dynamic';

export default async function AdminQuestionnairesPage() {
    const allItems = await getAllQuestionnaires();
    const sourceDocuments = allItems.filter((q: any) => q.status === "UPLOADED");

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Questionnaire Hub</h1>
                    <p className="text-slate-500 mt-1">Manage all questionnaires, templates, and raw source documents.</p>
                </div>
                <CreateQuestionnaireWizard sourceDocuments={sourceDocuments} allQuestionnaires={allItems} />
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 bg-white rounded-t-xl">
                    <CardTitle className="text-lg font-semibold text-slate-800">Unified Directory</CardTitle>
                    <CardDescription>All structured questionnaires and unmapped source documents</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    <QuestionnaireIndexList items={allItems as any} />
                </CardContent>
            </Card>
        </div>
    );
}
