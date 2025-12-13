import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Building2, CheckCircle, Mail, MessageSquare, Shield, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Solutions() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1">
                {/* Hero Section */}
                <div className="bg-slate-50 py-24 sm:py-32">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="mx-auto max-w-3xl text-center">
                            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl font-serif">
                                One Workflow. <br />
                                Endless Efficiency.
                            </h1>
                            <p className="mt-6 text-lg leading-8 text-slate-600">
                                Compass moves complex KYC and onboarding processes out of the chaos of email and into a secure, structured platform. Whether you are a Corporate, a Lender, or an Advisor, we make the process work for you.
                            </p>
                            <div className="mt-10 flex items-center justify-center gap-x-6">
                                <Button size="lg" variant="premium">
                                    Get Started
                                </Button>
                                <Link href="/how-it-works" className="text-sm font-semibold leading-6 text-slate-900">
                                    Learn how it works <span aria-hidden="true">→</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Problems Section */}
                <div className="py-24 sm:py-32">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                                    Escaping the Email Trap
                                </h2>
                                <p className="mt-6 text-lg text-slate-600">
                                    Today's onboarding process is a mess of unstructured data.
                                </p>
                                <ul className="mt-8 space-y-4">
                                    {[
                                        "Endless email chains with lost attachments.",
                                        "Duplicate data entry across 20+ different banking portals.",
                                        "Security risks from sharing sensitive docs via email.",
                                        "Zero visibility on process status."
                                    ].map((item, i) => (
                                        <li key={i} className="flex gap-3">
                                            <Mail className="h-6 w-6 text-rose-500 flex-shrink-0" />
                                            <span className="text-slate-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="relative rounded-2xl bg-slate-900 p-8 shadow-2xl">
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 bg-rose-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transform rotate-6">
                                    Deprectated
                                </div>
                                <div className="space-y-4 opacity-75">
                                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                        <div className="h-4 w-1/3 bg-slate-600 rounded mb-2"></div>
                                        <div className="h-3 w-3/4 bg-slate-700 rounded"></div>
                                    </div>
                                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 ml-8">
                                        <div className="h-4 w-1/4 bg-slate-600 rounded mb-2"></div>
                                        <div className="h-3 w-5/6 bg-slate-700 rounded"></div>
                                    </div>
                                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 font-mono text-xs text-slate-400">
                                        &gt; Fwd: Fwd: RE: Urgent: KYC Docs attached...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Solutions by Role */}
                <div className="bg-slate-50 py-24 sm:py-32">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="mx-auto max-w-2xl text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                                Built for Every Stakeholder
                            </h2>
                            <p className="mt-4 text-lg text-slate-600">
                                Compass unifies the workflow, providing value to every participant in the deal.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Corporate */}
                            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center mb-6">
                                    <Building2 className="h-6 w-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">For Corporates</h3>
                                <p className="text-slate-600 mb-6">
                                    Stop repeating yourself. Complete the Master Schema once and grant access to all your lenders.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                        <span>Write once, reuse everywhere</span>
                                    </li>
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                        <span>Maintain a single source of truth</span>
                                    </li>
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                        <span>Full audit trail of data sharing</span>
                                    </li>
                                </ul>
                            </div>

                            {/* FIs */}
                            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                                <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-6">
                                    <Shield className="h-6 w-6 text-indigo-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">For Lenders (FIs)</h3>
                                <p className="text-slate-600 mb-6">
                                    Receive perfectly structured, validated data. Slash your onboarding time and reduce operational risk.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                                        <span>Standardized input data</span>
                                    </li>
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                                        <span>Direct API integration</span>
                                    </li>
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                                        <span>Real-time updates on client changes</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Advisors */}
                            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center mb-6">
                                    <Users className="h-6 w-6 text-amber-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">For Advisors</h3>
                                <p className="text-slate-600 mb-6">
                                    Orchestrate the deal with visibility. Remove bottlenecks and ensure all parties have what they need.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                        <span>Centralized deal dashboard</span>
                                    </li>
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                        <span>Automated progress tracking</span>
                                    </li>
                                    <li className="flex gap-2 text-sm text-slate-700">
                                        <CheckCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                        <span>Secure document exchange</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="py-24">
                    <div className="container mx-auto px-4 md:px-6 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-6">
                            Ready to modernize your workflow?
                        </h2>
                        <div className="flex justify-center gap-4">
                            <Button size="lg" variant="default" className="bg-slate-900 hover:bg-slate-800">
                                Request a Demo
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
