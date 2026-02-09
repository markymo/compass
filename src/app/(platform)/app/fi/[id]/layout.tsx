import { notFound, redirect } from "next/navigation";
import { getFIOganization } from "@/actions/fi";
import { Building2 } from "lucide-react";

export default async function FILayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const org = await getFIOganization(id);

    if (!org) {
        // Obscurity
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-bold tracking-tight">404</h1>
                <p className="text-lg text-muted-foreground">This page could not be found.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 p-4 flex items-center gap-3 shadow-sm rounded-r-md">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                <div className="text-sm text-blue-900 dark:text-blue-200">
                    <span className="font-semibold block sm:inline">Financial Institution Area:</span>{" "}
                    <span className="opacity-90">Manage your institution's profile and questionnaires.</span>
                </div>
            </div>


            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <a
                        href={`/app/fi/${id}`}
                        className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
                    >
                        Overview
                    </a>
                    <a
                        href={`/app/fi/${id}/engagements`}
                        className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
                    >
                        Relationships
                    </a>
                    <a
                        href="#"
                        className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
                    >
                        Settings
                    </a>
                </nav>
            </div>

            {children}
        </div>
    );
}
