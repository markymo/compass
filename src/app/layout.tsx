import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { UsageTracker } from "@/components/usage-tracker";
import { Suspense } from "react";

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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
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
        </body>
      </html>
    </ClerkProvider >
  );
}
