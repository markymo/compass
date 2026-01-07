"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientDashboardPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/app/le");
    }, [router]);

    return (
        <div className="flex h-[50vh] items-center justify-center">
            <div className="text-sm text-muted-foreground">Redirecting to entities...</div>
        </div>
    );
}
