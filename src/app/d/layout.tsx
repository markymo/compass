import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "../globals.css"; // Reuse global tailwind setup
import { cn } from "@/lib/utils";

const playfair = Playfair_Display({
    variable: "--font-playfair",
    subsets: ["latin"],
});

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "ONpro | Private Preview",
    description: "Advanced financial infrastructure.",
};

export default function ExperimentalLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
            <body
                suppressHydrationWarning
                className={cn(
                    playfair.variable,
                    inter.variable,
                    "min-h-screen bg-black text-white font-sans antialiased selection:bg-teal-500 selection:text-white"
                )}
            >
                {/* Minimal Navigation Header */}
                <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 md:px-12">
                    <div className="flex items-center gap-1">
                        <span className="text-xl font-bold tracking-tighter">ONpro</span>
                        <div className="h-2 w-2 bg-teal-500" />
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide text-slate-300">
                        <a href="#" className="hover:text-white transition-colors">Solutions</a>
                        <a href="#" className="hover:text-white transition-colors">Platform</a>
                        <a href="#" className="hover:text-white transition-colors">Philosophy</a>
                        <a href="/app" className="ml-4 px-5 py-2 border border-white/20 rounded-full hover:bg-white hover:text-black transition-all">
                            Login
                        </a>
                    </nav>
                </header>

                <main className="flex-1">
                    {children}
                </main>

                {/* Simple Footer */}
                <footer className="py-12 px-6 md:px-12 border-t border-white/10 text-slate-500 text-xs">
                    <div className="max-w-7xl mx-auto flex justify-between">
                        <p>&copy; 2026 ONpro Financial Infrastructure.</p>
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-teal-500">Privacy</a>
                            <a href="#" className="hover:text-teal-500">Terms</a>
                        </div>
                    </div>
                </footer>
            </body>
        </html>
    );
}
