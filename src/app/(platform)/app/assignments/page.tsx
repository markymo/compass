import { getIdentity } from "@/lib/auth";
import { getUserAssignments, getTeamAssignments } from "@/actions/kyc-query";
import { redirect } from "next/navigation";
import { AssignmentsList, UnifiedAssignment } from "./AssignmentsList";
import Link from "next/link";
import { Home } from "lucide-react";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";

export default async function GlobalAssignmentsPage() {
    const identity = await getIdentity();

    if (!identity?.userId) {
        redirect("/login");
    }

    const [userAss, teamAss] = await Promise.all([
        getUserAssignments(identity.userId),
        getTeamAssignments()
    ]);

    const mapAssignments = (raw: typeof userAss): UnifiedAssignment[] => [
        ...raw.questions.map((q: any) => ({
            id: q.id,
            type: "question" as const,
            title: q.text,
            description: "",
            status: q.status,
            clientName: q.engagementOrgName ?? null,
            clientLEId: q.clientLEId ?? null,
            engagementId: q.engagementId ?? null,
            questionnaireId: q.questionnaireId ?? null,
            contextName: q.questionnaireName,
            assignedToUserId: q.assignedToUserId,
            assignedToUserName: q.assignedToUserName ?? "Team Member",
            assignedBy: q.assignedByUserName ?? "Unknown",
            note: q.note ?? null,
            createdAt: q.createdAt,
        })),
        ...raw.masterFields.map((f: any) => ({
            id: f.id,
            type: "master" as const,
            title: f.fieldName,
            description: "",
            status: f.workStatus === 'DONE' ? "Done" : "Open",
            workStatus: (f.workStatus || 'OPEN') as 'OPEN' | 'DONE',
            clientName: f.engagementOrgName ?? null,
            clientLEId: f.clientLEId ?? null,
            contextName: `Field ${f.fieldNo}`,
            assignedToUserId: f.assignedToUserId,
            assignedToUserName: f.assignedToUserName ?? "Team Member",
            assignedBy: f.assignedByUserName ?? "Unknown",
            note: f.note ?? null,
            createdAt: f.createdAt,
            fieldNo: f.fieldNo,
        }))
    ];

    const myAssignments = mapAssignments(userAss);
    const teamAssignments = mapAssignments(teamAss);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <StandardPageHeader
                title="Assignments"
                typeLabel="Tasks"
                subtitle="Global view of all tasks and data points assigned across your personal workload and team."
                breadcrumbs={[{ label: "Home", href: "/app", icon: Home }, { label: "Assignments" }]}
            />

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 w-full">
                <AssignmentsList myAssignments={myAssignments} teamAssignments={teamAssignments} currentUserId={identity.userId} />
            </div>
        </div>
    );
}
