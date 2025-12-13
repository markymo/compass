import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, Database, FileSpreadsheet, Globe, Share2 } from "lucide-react";

export default function HowItWorks() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 pt-32 pb-16">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="mx-auto max-w-3xl text-center">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
                            From Chaos to Compass
                        </h1>
                        <p className="mt-6 text-lg text-slate-600">
                            A breakdown of how Compass eliminates duplication for Corporates and Financial Institutions.
                        </p>
                    </div>

                    <div className="mt-24 space-y-24">

                        {/* Step 1 */}
                        <div className="flex flex-col items-center gap-12 lg:flex-row">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 border border-blue-200">
                                    <Database className="h-6 w-6 text-blue-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900">1. The Master Schema</h2>
                                <p className="text-lg text-slate-600">
                                    Instead of filling out 20 different forms, you populate the Master Schema once.
                                    This schema contains the superset of all regulatory data required by FIs.
                                </p>
                            </div>
                            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
                                {/* Visual placeholder */}
                                <div className="space-y-3">
                                    <div className="h-4 w-3/4 rounded bg-slate-200"></div>
                                    <div className="h-4 w-1/2 rounded bg-slate-200"></div>
                                    <div className="h-4 w-5/6 rounded bg-slate-200"></div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col items-center gap-12 lg:flex-row-reverse">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 border border-indigo-200">
                                    <Globe className="h-6 w-6 text-indigo-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900">2. Standardization & Validation</h2>
                                <p className="text-lg text-slate-600">
                                    Our system validates your data against industry standards (GLEIF, ISO).
                                    Ambiguities are removed before they reach the banks.
                                </p>
                            </div>
                            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
                                {/* Visual placeholder */}
                                <div className="flex justify-center">
                                    <div className="h-24 w-24 rounded-full border-4 border-green-200 flex items-center justify-center bg-white">
                                        <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col items-center gap-12 lg:flex-row">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 border border-amber-200">
                                    <Share2 className="h-6 w-6 text-amber-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900">3. Frictionless Distribution</h2>
                                <p className="text-lg text-slate-600">
                                    Grant access to FIs. They receive the data exactly how they need it—whether
                                    that's populated into their legacy Excel templates or via API.
                                </p>
                            </div>
                            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
                                {/* Visual placeholder */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-20 rounded bg-slate-200"></div>
                                    <div className="h-20 rounded bg-slate-200"></div>
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
