import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, Database, FileSpreadsheet, Globe, Share2 } from "lucide-react";

export default function HowItWorks() {
    return (
        <div className="flex min-h-screen flex-col bg-slate-950">
            <Navbar />
            <main className="flex-1 pt-32 pb-16">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="mx-auto max-w-3xl text-center">
                        <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                            From Chaos to Compass
                        </h1>
                        <p className="mt-6 text-lg text-slate-400">
                            A breakdown of how Compass eliminates duplication for Corporates and Financial Institutions.
                        </p>
                    </div>

                    <div className="mt-24 space-y-24">

                        {/* Step 1 */}
                        <div className="flex flex-col items-center gap-12 lg:flex-row">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <Database className="h-6 w-6 text-blue-500" />
                                </div>
                                <h2 className="text-3xl font-bold text-white">1. The Master Schema</h2>
                                <p className="text-lg text-slate-400">
                                    Instead of filling out 20 different forms, you populate the Master Schema once.
                                    This schema contains the superset of all regulatory data required by FIs.
                                </p>
                            </div>
                            <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                                {/* Visual placeholder */}
                                <div className="space-y-3">
                                    <div className="h-4 w-3/4 rounded bg-slate-800"></div>
                                    <div className="h-4 w-1/2 rounded bg-slate-800"></div>
                                    <div className="h-4 w-5/6 rounded bg-slate-800"></div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col items-center gap-12 lg:flex-row-reverse">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                    <Globe className="h-6 w-6 text-indigo-500" />
                                </div>
                                <h2 className="text-3xl font-bold text-white">2. Standardization & Validation</h2>
                                <p className="text-lg text-slate-400">
                                    Our system validates your data against industry standards (GLEIF, ISO).
                                    Ambiguities are removed before they reach the banks.
                                </p>
                            </div>
                            <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                                {/* Visual placeholder */}
                                <div className="flex justify-center">
                                    <div className="h-24 w-24 rounded-full border-4 border-green-500/20 flex items-center justify-center">
                                        <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col items-center gap-12 lg:flex-row">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <Share2 className="h-6 w-6 text-amber-500" />
                                </div>
                                <h2 className="text-3xl font-bold text-white">3. Frictionless Distribution</h2>
                                <p className="text-lg text-slate-400">
                                    Grant access to FIs. They receive the data exactly how they need it—whether
                                    that's populated into their legacy Excel templates or via API.
                                </p>
                            </div>
                            <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                                {/* Visual placeholder */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-20 rounded bg-slate-800"></div>
                                    <div className="h-20 rounded bg-slate-800"></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
