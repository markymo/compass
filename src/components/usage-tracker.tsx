"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logActivity } from "@/actions/logging";

export function UsageTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Debounce or just log immediately? Navigation is distinct event.
        // We log the page view.
        const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

        // Fire and forget
        logActivity("PAGE_VIEW", url);

    }, [pathname, searchParams]);

    return null; // Renderless component
}
