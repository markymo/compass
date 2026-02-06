import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { UsageTracker } from "@/components/usage-tracker";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Compass | Sovereign Identity for Finance",
  description: "The single source of truth for corporate debt finance onboarding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthSessionProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          suppressHydrationWarning
          className={cn(
            playfair.variable,
            inter.variable,
            "antialiased min-h-screen bg-background text-foreground font-sans"
          )}
        >
          <Suspense fallback={null}>
            <UsageTracker />
          </Suspense>
          {children}
          <Toaster />
        </body>
      </html>
    </AuthSessionProvider>
  );
}
