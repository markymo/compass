import { getIdentity } from "@/lib/auth";
import { getUserAssignments } from "@/actions/kyc-query";
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

    const assignments = await getUserAssignments(identity.userId);

    // Map to unified structure
    const unified: UnifiedAssignment[] = [
        ...assignments.questions.map((q: any) => ({
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
        ...assignments.masterFields.map((f: any) => ({
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
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            <StandardPageHeader
                title="Assignments"
                typeLabel="Tasks"
                subtitle="Global view of all tasks and data points assigned to you across all clients and workspaces."
                breadcrumbs={[{ label: "Home", href: "/app", icon: Home }, { label: "Assignments" }]}
            />

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 w-full">
                <AssignmentsList assignments={unified} />
            </div>
        </div>
    );
}
