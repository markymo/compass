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
        if (variant === "v1") {
            params.set("home", "v1");
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
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted p-1 rounded-md border border-border shrink-0"
        >
            <span className="px-1 font-medium text-muted-foreground select-none">
                Home view:
            </span>
            <button
                type="button"
                onClick={() => setVariant("v2")}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    currentVariant === "v2"
                        ? "bg-card text-foreground shadow-xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                Current
            </button>
            <button
                type="button"
                onClick={() => setVariant("v1")}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    currentVariant === "v1"
                        ? "bg-card text-foreground shadow-xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                Classic
            </button>
        </div>
    );
}
