import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { Layers } from "lucide-react";
import { SourcesUserTabs } from "@/components/layout/sources-user-tabs";

interface UserLayoutProps {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}

export default async function UserLayout({ children, params }: UserLayoutProps) {
    const { id } = await params;

    return (
        <div className="space-y-6 max-w-5xl">
            <SetPageBreadcrumbs items={[]} />

            {/* Header Area */}
            <div className="space-y-2 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2 text-slate-800">
                    <Layers className="h-6 w-6 text-slate-500" />
                    <h2 className="text-xl font-semibold tracking-tight">User Content</h2>
                </div>
            </div>

            <SourcesUserTabs leId={id} />
            
            {children}
        </div>
    );
}
