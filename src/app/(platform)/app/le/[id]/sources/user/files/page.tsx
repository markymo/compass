import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCCFiles } from "@/actions/cc-file-actions";
import { CCFileManager } from "@/components/client/ccc/cc-file-manager";

interface FilesPageProps {
    params: Promise<{ id: string }>;
}

export default async function FilesPage({ params }: FilesPageProps) {
    const { id } = await params;
    const le = await prisma.clientLE.findUnique({ where: { id }, select: { id: true } });
    if (!le) return notFound();

    const curatedFiles = await getCCFiles(id);
    return (
        <div className="space-y-4">
            <CCFileManager clientLEId={id} initialFiles={curatedFiles} />
        </div>
    );
}
