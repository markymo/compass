"use client";

import { Building2, Landmark, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ValueProp() {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 font-serif sm:text-4xl">
                        One Platform, Two massive Advantages
                    </h2>
                    <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
                        Whether you are raising capital or providing it, Compass
                        removes the friction from the equation.
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">

                    {/* For Clients */}
                    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/50 p-8 md:p-12 transition-all hover:border-slate-300 hover:shadow-lg">
                        <div className="h-12 w-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-8 border border-slate-100">
                            <Building2 className="h-6 w-6 text-slate-900" />
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 font-serif mb-4">
                            For Corporate Clients
                        </h3>
                        <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                            Why fill out 20+ complicated forms when you can fill out just one?
                            Compass acts as a project management tool for your advisory team,
                            giving you a single picture of your entire onboarding status.
                        </p>

                        <ul className="space-y-4 mb-8">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Massive efficiency gain (20-to-1 reduction)</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Coordinate your Treasury, Legal, and Tax teams</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Secure, sovereign control of your data</span>
                            </li>
                        </ul>

                        <Button variant="outline" className="w-full sm:w-auto">
                            Client Solutions <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>

                    {/* For FIs */}
                    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 p-8 md:p-12 transition-all hover:shadow-xl">
                        <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center mb-8 border border-slate-700">
                            <Landmark className="h-6 w-6 text-white" />
                        </div>

                        <h3 className="text-2xl font-bold text-white font-serif mb-4">
                            For Financial Institutions
                        </h3>
                        <p className="text-slate-300 mb-8 text-lg leading-relaxed">
                            By validating against the Compass Master Schema, you signal to the market
                            that you prioritize efficiency. Improve data quality, remove inconsistency,
                            and streamline your KYC processes.
                        </p>

                        <ul className="space-y-4 mb-8">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-slate-200">Receive perfectly standardized, validated data</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-slate-200">Demonstrate "Ease of Doing Business" to top clients</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-slate-200">Reduce back-and-forth query loops by 80%</span>
                            </li>
                        </ul>

                        <Button variant="gold" className="w-full sm:w-auto border border-transparent">
                            FI Solutions <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>

                </div>
            </div>
        </section>
    );
}
