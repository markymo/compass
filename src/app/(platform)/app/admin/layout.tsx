import { notFound } from "next/navigation";
import { isSystemAdmin } from "@/actions/admin";
import { ShieldAlert } from "lucide-react";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const isAdmin = await isSystemAdmin();

    if (!isAdmin) {
        // Security through obscurity: Return 404 instead of 403
        notFound();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 flex items-center gap-3 shadow-sm rounded-r-md">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                <div className="text-sm text-amber-900 dark:text-amber-200">
                    <span className="font-semibold block sm:inline">System Admin Area:</span>{" "}
                    <span className="opacity-90">Exercise caution. Configuration changes will affect all tenants.</span>
                </div>
            </div>

            {children}
        </div>
    );
}
