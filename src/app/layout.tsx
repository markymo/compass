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
import { StagingBanner } from "@/components/dev/staging-banner";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
import { isNonProductionEnv } from "@/lib/env";

const isNonProd = isNonProductionEnv();

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.website),
  title: {
    default: `${BRAND.name} | Sovereign Identity for Finance`,
    template: `%s | ${BRAND.name}`,
  },
  description: "The single source of truth for corporate debt finance onboarding.",
  robots: isNonProd
    ? {
        index: false,
        follow: false,
        noarchive: true,
        nocache: true,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      }
    : {
        index: true,
        follow: true,
      },
  openGraph: {
    title: `${BRAND.name} | Sovereign Identity for Finance`,
    description: "The single source of truth for corporate debt finance onboarding.",
    url: BRAND.website,
    siteName: BRAND.name,
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} | Sovereign Identity for Finance`,
    description: "The single source of truth for corporate debt finance onboarding.",
  },
};

import { SpeedInsights } from "@vercel/speed-insights/next";

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthSessionProvider>
            <UserPreferencesProvider>
              <StagingBanner />
              <Suspense fallback={null}>
                <UsageTracker />
              </Suspense>
              {children}
              <Toaster />
              <DevFeedbackGate />
              <SpeedInsights />
            </UserPreferencesProvider>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
