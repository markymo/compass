"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Check, Building2, Shield, Landmark } from "lucide-react";
import { switchOrganization } from "@/actions/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Org {
    id: string;
    name: string;
    types: string[];
}

interface OrgSwitcherProps {
    currentOrgName: string;
    currentOrgTypes: string[];
    availableOrgs: Org[];
}

export function OrgSwitcher({ currentOrgName, currentOrgTypes, availableOrgs }: OrgSwitcherProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSwitch = (orgId: string) => {
        startTransition(async () => {
            await switchOrganization(orgId);
            // Router refresh handled in server action via revalidatePath
        });
    };

    const getIcon = (types: string[]) => {
        if (types.includes("SYSTEM")) return <Shield className="h-4 w-4" />;
        if (types.includes("FI")) return <Landmark className="h-4 w-4" />;
        return <Building2 className="h-4 w-4" />;
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    disabled={isPending}
                    className="w-[200px] justify-between bg-white text-slate-700 border-slate-200"
                >
                    <span className="flex items-center gap-2 truncate">
                        {getIcon(currentOrgTypes)}
                        <span className="truncate">{currentOrgName}</span>
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] p-0">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5 font-normal">
                    Switch Organization
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableOrgs.map((org) => (
                    <DropdownMenuItem
                        key={org.id}
                        onSelect={() => handleSwitch(org.id)}
                        className="cursor-pointer"
                    >
                        <div className="flex items-center gap-2 w-full">
                            {getIcon(org.types)}
                            <span className="truncate flex-1">{org.name}</span>
                            {org.name === currentOrgName && (
                                <Check className="ml-auto h-4 w-4 opacity-100" />
                            )}
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
