"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BRAND } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { HOME_FOOTER_ACCENT_COMPOSITION } from "@/config/section-accent";
import { cn } from "@/lib/utils";

export default function ComingSoonPage() {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen flex-col justify-between bg-white text-slate-900 font-sans">
      {/* Header Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        {/* Top Left: Logo Only */}
        <Link href="/" className="flex items-center">
          <img src="/logo.svg" alt={BRAND.name} className="h-10 w-auto" />
        </Link>

        {/* Top Right: Sign In or Go to App */}
        <div className="flex items-center gap-4">
          {session ? (
            <Button asChild variant="premium" size="sm">
              <Link href="/app">Go to App</Link>
            </Button>
          ) : (
            <Button asChild variant="premium" size="sm">
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Main Minimal Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
        <span className="text-xs md:text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
          Platform Private Preview
        </span>
      </main>

      {/* Bottom Area with Multi-Colour Line & Footer */}
      <footer className="w-full relative">
        {/* Multi-Colour Accent Line */}
        <div className="h-[3px] flex w-full overflow-hidden">
          {HOME_FOOTER_ACCENT_COMPOSITION.map((seg) => (
            <div
              key={seg.label}
              className={cn("h-full shrink-0", seg.colorClass)}
              style={{ width: `${seg.widthPercent}%` }}
            />
          ))}
        </div>

        {/* Minimal Footer Text */}
        <div className="w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {BRAND.legalName || BRAND.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
