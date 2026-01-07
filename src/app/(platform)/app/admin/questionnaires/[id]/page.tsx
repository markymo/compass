import { getQuestionnaireById } from "@/actions/questionnaire";
import { getMasterSchemaFields } from "@/actions/schema-utils";
import { QuestionnaireManager } from "@/components/admin/questionnaire/questionnaire-manager";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function ManageQuestionnairePage({ params }: PageProps) {
    const { id } = await params;

    const [questionnaire, masterFields] = await Promise.all([
        getQuestionnaireById(id),
        getMasterSchemaFields()
    ]);

    if (!questionnaire) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-slate-500">Questionnaire not found</div>
            </div>
        );
    }

    return (
        <QuestionnaireManager
            questionnaire={questionnaire}
            masterFields={masterFields}
        />
    );
}
