import Link from "next/link";
import { Compass, Settings } from "lucide-react";
import { UserNav } from "./UserNav";
import { Button } from "@/components/ui/button";

interface PlatformNavbarProps {
    orgName?: string;
    orgTypes?: string[];
    availableOrgs?: { id: string; name: string; types: string[] }[];
}

export function PlatformNavbar({ orgName = "", orgTypes = [], availableOrgs = [] }: PlatformNavbarProps) {
    return (
        <header className="sticky top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-8">
                    <Link href="/app" className="flex items-center gap-2">
                        <div className="relative flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white">
                            <Compass className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900 font-serif">
                            COMPASS
                        </span>
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    {orgTypes.includes("SYSTEM") && (
                        <Button variant="ghost" size="icon" asChild className="text-slate-500 hover:text-slate-900">
                            <Link href="/app/admin">
                                <Settings className="h-5 w-5" />
                            </Link>
                        </Button>
                    )}
                    <UserNav />
                </div>
            </div>
        </header>
    );
}
