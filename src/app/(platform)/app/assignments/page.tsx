import { getIdentity } from "@/lib/auth";
import { getUserAssignments } from "@/actions/kyc-query";
import { redirect } from "next/navigation";
import { AssignmentsList, UnifiedAssignment } from "./AssignmentsList";

export default async function GlobalAssignmentsPage() {
    const identity = await getIdentity();

    if (!identity?.userId) {
        redirect("/login");
    }

    const assignments = await getUserAssignments(identity.userId);

    // Map to unified structure
    const unified: UnifiedAssignment[] = [
        ...assignments.questions.map(q => ({
            id: q.id,
            type: "question" as const,
            title: q.text,
            description: "",
            status: q.status,
            clientName: q.engagementOrgName ?? null,
            clientLEId: q.clientLEId ?? null,
            contextName: q.questionnaireName,
            assignedBy: q.assignedByUserName ?? "Unknown",
            createdAt: q.createdAt,
        })),
        ...assignments.masterFields.map(f => ({
            id: f.id,
            type: "master" as const,
            title: f.fieldName,
            description: "",
            status: "Assigned",
            clientName: f.engagementOrgName ?? null,
            clientLEId: f.clientLEId ?? null,
            contextName: `Field ${f.fieldNo}`,
            assignedBy: f.assignedByUserName ?? "Unknown",
            createdAt: f.createdAt,
            fieldNo: f.fieldNo,
        }))
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-b pb-4">My Assignments</h1>
                <p className="text-sm text-slate-500 mt-2">
                    Global view of all tasks and data points assigned to you across all clients and workspaces.
                </p>
            </div>

            <AssignmentsList assignments={unified} />
        </div>
    );
}
