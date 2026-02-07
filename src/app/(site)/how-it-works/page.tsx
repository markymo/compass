import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Upload, Sparkles, Zap, ArrowRight, BrainCircuit, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HowItWorks() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 pt-32 pb-16">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="mx-auto max-w-3xl text-center">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl mb-6">
                            Smart. Organic. Effortless.
                        </h1>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            Stop filling out multiple compliance forms. <br className="hidden md:block" />
                            Stop maintaining "Master Spreadsheets". <br className="hidden md:block" />
                            ONpro builds your Knowledge Base automatically as you work.
                        </p>
                    </div>

                    <div className="mt-24 space-y-32">

                        {/* Step 1 */}
                        <div className="flex flex-col items-center gap-16 lg:flex-row">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 shadow-sm">
                                    <Upload className="h-7 w-7 text-blue-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900">1. Start with any questionnaire</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    There is no complex setup. Simply upload the questionnaire you need to complete right now.
                                    Fill it out once using our intuitive interface. That's it—no data migration projects, no IT heavy lifting.
                                </p>
                            </div>
                            <div className="flex-1 relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 border-b pb-4">
                                            <div className="h-10 w-10 rounded-full bg-slate-100"></div>
                                            <div className="space-y-2">
                                                <div className="h-2.5 w-32 rounded-full bg-slate-200"></div>
                                                <div className="h-2 w-20 rounded-full bg-slate-100"></div>
                                            </div>
                                        </div>
                                        <div className="space-y-3 pt-2">
                                            <div className="h-2 w-full rounded-full bg-slate-100"></div>
                                            <div className="h-2 w-5/6 rounded-full bg-slate-100"></div>
                                            <div className="h-10 w-full rounded-lg bg-blue-50 border border-blue-100 flex items-center px-4 text-sm text-blue-700 font-medium">
                                                Active Questionnaire
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col items-center gap-16 lg:flex-row-reverse">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 border border-purple-100 shadow-sm">
                                    <BrainCircuit className="h-7 w-7 text-purple-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900">2. We build your "Knowledge Base"</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    As you work, ONpro is learning. It automatically extracts your answers, policies, and corporate details
                                    to build your live <strong>Knowledge Base</strong> library. Your knowledge base grows organically with every question you answer.
                                </p>
                            </div>
                            <div className="flex-1 relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                                    <div className="flex items-center justify-center h-48">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-20"></div>
                                            <div className="relative z-10 bg-white p-4 rounded-xl border shadow-sm flex flex-col items-center gap-2">
                                                <Sparkles className="h-8 w-8 text-purple-500" />
                                                <span className="text-xs font-bold text-slate-600">Knowledge Added</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col items-center gap-16 lg:flex-row">
                            <div className="flex-1 space-y-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                    <Zap className="h-7 w-7 text-emerald-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900">3. Never repeat yourself</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    The next time a questionnaire comes in, ONpro auto-fills it using your Knowledge Base.
                                    You only need to answer the <em>new</em> questions—the "delta".
                                    And guess what? Those new answers instantly update your Knowledge Base for next time.
                                </p>
                            </div>
                            <div className="flex-1 relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 w-fit px-3 py-1 rounded-full">
                                            <RefreshCw className="h-3 w-3" />
                                            Auto-Filled: 92%
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-2 w-full rounded bg-slate-100"></div>
                                            <div className="h-12 rounded-lg bg-emerald-50/50 border border-emerald-100 p-3">
                                                <div className="h-2 w-3/4 bg-emerald-200/50 rounded"></div>
                                            </div>
                                            <div className="h-12 rounded-lg bg-emerald-50/50 border border-emerald-100 p-3">
                                                <div className="h-2 w-1/2 bg-emerald-200/50 rounded"></div>
                                            </div>
                                            <div className="h-12 rounded-lg border-2 border-dashed border-slate-200 p-3 flex items-center justify-center text-slate-400 text-sm">
                                                You only do this part
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="mt-32 text-center space-y-8">
                        <h3 className="text-2xl font-bold text-slate-900">Ready to stop the busywork?</h3>
                        <Link href="/auth/register">
                            <Button size="lg" className="h-12 px-8 text-lg bg-slate-900 text-white hover:bg-slate-800 gap-2">
                                Get Started <ArrowRight className="h-5 w-5" />
                            </Button>
                        </Link>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}
