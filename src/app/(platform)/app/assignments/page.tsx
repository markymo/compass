import { getIdentity } from "@/lib/auth";
import { getUserAssignments } from "@/actions/kyc-query";
import { redirect } from "next/navigation";
import { AssignmentsList, UnifiedAssignment } from "./AssignmentsList";
import Link from "next/link";
import { Home } from "lucide-react";

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
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Link href="/app" className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors block">
                    <Home className="h-6 w-6 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">My assigned tasks</h1>
                    <p className="text-muted-foreground text-sm">
                        Global view of all tasks and data points assigned to you across all clients and workspaces.
                    </p>
                </div>
            </div>

            <AssignmentsList assignments={unified} />
        </div>
    );
}
