
import { GuideHeader } from "@/components/layout/GuideHeader";
import { Users, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getFIOganization } from "@/actions/fi";

export default async function FITeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const org = await getFIOganization(id);

    if (!org) return <div>Unauthorized</div>;

    return (
        <div className="flex flex-col min-h-screen">
            <GuideHeader
                breadcrumbs={[
                    { label: "", href: "/app", icon: Home },
                    { label: org.name, href: `/app/fi/${id}`, icon: Users },
                    { label: "Team Members", icon: Users }
                ]}
            />
            <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-slate-100 rounded-full">
                    <Users className="h-8 w-8 text-slate-400" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900">Team Management</h1>
                <p className="text-slate-500 text-center max-w-md">
                    Manage users and roles for {org.name}.
                    <br />
                    This feature is under development.
                </p>
                <Button variant="outline" asChild>
                    <Link href={`/app/fi/${id}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                    </Link>
                </Button>
            </div>
        </div>
    );
}
