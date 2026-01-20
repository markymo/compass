import { getQuestionnaireById } from "@/actions/questionnaire";
import { getMasterSchemaFields } from "@/actions/schema-utils";
import { QuestionnaireManager } from "@/components/admin/questionnaire/questionnaire-manager";
import { notFound, redirect } from "next/navigation";
import { getUserFIOrg } from "@/actions/security";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function FIQuestionnaireManagePage({ params }: PageProps) {
    const { id } = await params;

    // Verify Access: User must belong to the FI that owns this questionnaire
    const [questionnaire, masterFields, userOrg] = await Promise.all([
        getQuestionnaireById(id),
        getMasterSchemaFields(),
        getUserFIOrg()
    ]);

    if (!questionnaire) {
        return notFound();
    }

    if (!userOrg || userOrg.id !== questionnaire.fiOrgId) {
        // Strict check: FI users can only manage their own questionnaires
        // (System Admins would use the /admin route)
        return redirect("/app/fi");
    }

    return (
        <QuestionnaireManager
            questionnaire={questionnaire}
            masterFields={masterFields}
        />
    );
}
