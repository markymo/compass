"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

export interface HomeVariantSwitcherProps {
    currentVariant: "v1" | "v2";
}

export function HomeVariantSwitcher({ currentVariant }: HomeVariantSwitcherProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const setVariant = (variant: "v1" | "v2") => {
        const params = new URLSearchParams(searchParams?.toString() || "");
        if (variant === "v2") {
            params.set("home", "v2");
        } else {
            params.delete("home");
        }
        const queryString = params.toString();
        const url = queryString ? `${pathname}?${queryString}` : pathname;
        router.push(url);
    };

    return (
        <div
            data-testid="home-variant-switcher"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100/90 dark:bg-zinc-800/90 p-1 rounded-md border border-slate-200/80 dark:border-zinc-700/80 shrink-0"
        >
            <span className="px-1 font-medium text-slate-400 dark:text-zinc-400 select-none">
                Home view:
            </span>
            <button
                type="button"
                onClick={() => setVariant("v1")}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    currentVariant === "v1"
                        ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 dark:bg-zinc-900 dark:text-slate-100 dark:border-zinc-700"
                        : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
            >
                Current
            </button>
            <button
                type="button"
                onClick={() => setVariant("v2")}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    currentVariant === "v2"
                        ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 dark:bg-zinc-900 dark:text-slate-100 dark:border-zinc-700"
                        : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
            >
                Experimental
            </button>
        </div>
    );
}
