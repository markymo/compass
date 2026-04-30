import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

// Force Server Context Reload - Architecture Sync 2026-04-22
import { cn } from "@/lib/utils";
import { UsageTracker } from "@/components/usage-tracker";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DevFeedbackGate } from "@/components/dev/dev-feedback-gate";
import { UserPreferencesProvider } from "@/components/providers/user-preferences-provider";

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import { BRAND } from "@/config/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} | Sovereign Identity for Finance`,
  description: "The single source of truth for corporate debt finance onboarding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          outfit.variable,
          inter.variable,
          "antialiased min-h-screen bg-background text-foreground font-sans"
        )}
      >
        <AuthSessionProvider>
          <UserPreferencesProvider>
            <Suspense fallback={null}>
              <UsageTracker />
            </Suspense>
            {children}
            <Toaster />
            <DevFeedbackGate />
          </UserPreferencesProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
