"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function RedirectTo({ path }: { path: string }) {
    const router = useRouter();

    useEffect(() => {
        router.replace(path);
    }, [path, router]);

    return (
        <div className="flex h-[50vh] w-full items-center justify-center flex-col gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Redirecting to active dashboard...</p>
        </div>
    );
}
