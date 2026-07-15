import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { getCCParties } from "@/actions/cc-party-actions";
import { CCPartyManager } from "@/components/client/ccc/cc-party-manager";
import { getCCAddresses } from "@/actions/cc-address-actions";
import { CCAddressManager } from "@/components/client/ccc/cc-address-manager";
import { getCCFiles } from "@/actions/cc-file-actions";
import { CCFileManager } from "@/components/client/ccc/cc-file-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserPageProps {
    params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: UserPageProps) {
    const { id } = await params;

    // Verify Legal Entity existence
    const le = await prisma.clientLE.findUnique({
        where: { id },
        select: { id: true }
    });

    if (!le) {
        return notFound();
    }

    // Load curated parties, addresses, and files
    const [curatedParties, curatedAddresses, curatedFiles] = await Promise.all([
        getCCParties(id),
        getCCAddresses(id),
        getCCFiles(id)
    ]);

    return (
        <div className="space-y-6 max-w-5xl">
            <SetPageBreadcrumbs
                items={[]}
            />

            {/* Header Area */}
            <div className="space-y-2 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-2 text-slate-800">
                    <Layers className="h-6 w-6 text-slate-500" />
                    <h2 className="text-xl font-semibold tracking-tight">User Content</h2>
                </div>
            </div>

            <Tabs defaultValue="parties" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="parties">Parties</TabsTrigger>
                    <TabsTrigger value="addresses">Addresses</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>
                
                <TabsContent value="parties" className="space-y-4">
                    {/* Curated Parties Manager */}
                    <CCPartyManager 
                        clientLEId={id} 
                        initialParties={curatedParties} 
                    />
                </TabsContent>

                <TabsContent value="addresses" className="space-y-4">
                    {/* Curated Addresses Manager */}
                    <CCAddressManager 
                        clientLEId={id} 
                        initialAddresses={curatedAddresses} 
                    />
                </TabsContent>

                <TabsContent value="files">
                    {/* Curated Files Manager */}
                    <CCFileManager 
                        clientLEId={id} 
                        initialFiles={curatedFiles} 
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
