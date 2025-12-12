import { notFound } from "next/navigation";
import { isSystemAdmin } from "@/actions/admin";

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
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 px-4 py-2 rounded-md text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
                <span className="font-bold">SYSTEM ADMIN AREA</span>
                <span className="opacity-75">- Exercise caution. Changes affect all tenants.</span>
            </div>
            {children}
        </div>
    );
}
