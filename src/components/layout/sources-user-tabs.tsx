"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SourcesUserTabsProps {
    leId: string;
}

export function SourcesUserTabs({ leId }: SourcesUserTabsProps) {
    const pathname = usePathname();
    const basePath = `/app/le/${leId}/sources/user`;

    // Determine the active tab based on the URL path
    let activeTab = "parties";
    if (pathname.includes("/addresses")) activeTab = "addresses";
    if (pathname.includes("/files")) activeTab = "files";

    return (
        <Tabs value={activeTab} className="w-full">
            <TabsList className="mb-4">
                <TabsTrigger value="parties" asChild>
                    <Link href={`${basePath}/parties`}>Parties</Link>
                </TabsTrigger>
                <TabsTrigger value="addresses" asChild>
                    <Link href={`${basePath}/addresses`}>Addresses</Link>
                </TabsTrigger>
                <TabsTrigger value="files" asChild>
                    <Link href={`${basePath}/files`}>Files</Link>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
