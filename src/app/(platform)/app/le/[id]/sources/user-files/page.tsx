import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { DocumentLibraryService } from "@/lib/documents/DocumentLibraryService";
import { FilesLibraryManager } from "@/components/client/documents/FilesLibraryManager";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

interface UserFilesPageProps {
    params: Promise<{ id: string }>;
}

export default async function UserFilesPage({ params }: UserFilesPageProps) {
    const { id } = await params;
    const le = await prisma.clientLE.findUnique({ where: { id }, select: { id: true } });
    if (!le) return notFound();

    const initialFiles = await DocumentLibraryService.listLibraryDocuments(id);
    
    return (
        <div className="space-y-6 w-full">
            <SetPageBreadcrumbs items={[]} />
            <FilesLibraryManager clientLEId={id} initialFiles={initialFiles} />
        </div>
    );
}
