"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminAppReturnLink() {
    const pathname = usePathname();
    
    if (!pathname?.startsWith("/app/admin")) {
        return null;
    }
    
    return (
        <Link 
            href="/app" 
            className="text-xs font-mono font-medium text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
        >
            [app]
        </Link>
    );
}
