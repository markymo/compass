"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface HomeVariantSwitcherProps {
    currentVariant: "v1" | "v2";
}

export function HomeVariantSwitcher({ currentVariant }: HomeVariantSwitcherProps) {
    const pathname = usePathname();

    return (
        <div
            data-testid="home-variant-switcher"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted p-1 rounded-md border border-border shrink-0"
        >
            <span className="px-1 font-medium text-muted-foreground select-none">
                Home view:
            </span>
            <Link
                href={pathname || "/app"}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    currentVariant === "v2"
                        ? "bg-card text-foreground shadow-xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                Current
            </Link>
            <Link
                href={`${pathname || "/app"}?home=v1`}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    currentVariant === "v1"
                        ? "bg-card text-foreground shadow-xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                }`}
            >
                Classic
            </Link>
        </div>
    );
}
