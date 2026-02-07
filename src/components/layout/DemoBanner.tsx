
"use client";

import { useSession } from "next-auth/react";
import { X, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

export function DemoBanner() {
    const { data: session } = useSession();

    // @ts-ignore - Session type doesn't know about isDemoActor without augmentation
    const isDemoActor = session?.user?.isDemoActor;

    if (!isDemoActor) return null;

    return (
        <div className="bg-amber-600 text-white font-medium px-4 py-2 flex items-center justify-between text-sm shadow-md sticky top-0 z-[60]">
            <div className="flex items-center gap-2 animate-pulse">
                <UserCheck className="h-4 w-4" />
                <span className="uppercase tracking-wide font-bold">Demo Mode Active: {session?.user?.name}</span>
            </div>

            <Button
                variant="ghost"
                size="sm"
                className="hover:bg-amber-700 text-white hover:text-white h-7 px-3 border border-amber-500/50"
                onClick={() => signOut({ callbackUrl: "/login" })}
            >
                End Demo <X className="ml-1 h-3 w-3" />
            </Button>
        </div>
    );
}
