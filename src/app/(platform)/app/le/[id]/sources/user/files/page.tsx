import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { DocumentLibraryService } from "@/lib/documents/DocumentLibraryService";
import { FilesLibraryManager } from "@/components/client/documents/FilesLibraryManager";

interface FilesPageProps {
    params: Promise<{ id: string }>;
}

export default async function FilesPage({ params }: FilesPageProps) {
    const { id } = await params;
    const le = await prisma.clientLE.findUnique({ where: { id }, select: { id: true } });
    if (!le) return notFound();

    const initialFiles = await DocumentLibraryService.listLibraryDocuments(id);
    
    return (
        <div className="space-y-4">
            <FilesLibraryManager clientLEId={id} initialFiles={initialFiles} />
        </div>
    );
}
