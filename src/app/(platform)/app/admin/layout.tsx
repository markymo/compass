import { notFound } from "next/navigation";
import { isSystemAdmin } from "@/actions/admin";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminBreadcrumb } from "@/components/layout/AdminBreadcrumb";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const isAdmin = await isSystemAdmin();

    if (!isAdmin) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-bold tracking-tight">404</h1>
                <p className="text-lg text-muted-foreground">This page could not be found.</p>
            </div>
        );
    }

    return (
        <div className="flex -mx-4 md:-mx-8 -mt-4 md:-mt-8 min-h-[calc(100vh-5rem)]">
            <AdminSidebar />
            <div className="flex-1 p-6 md:p-8 overflow-auto">
                <AdminBreadcrumb />
                {children}
            </div>
        </div>
    );
}
