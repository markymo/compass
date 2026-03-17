"use client";

import { Building2, Landmark, CheckCircle2, ArrowRight, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";

export function ValueProp() {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 font-serif sm:text-4xl">
                        One platform, benefiting all
                    </h2>
                    <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
                        Whether you are requesting corporate data or providing it, {BRAND.name}
                        removes the friction from the equation
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-2 items-stretch">

                    {/* For Clients */}
                    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/50 p-8 md:p-12 transition-all hover:border-slate-300 hover:shadow-lg flex flex-col">
                        <div className="h-12 w-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-8 border border-slate-100">
                            <Building2 className="h-6 w-6 text-slate-900" />
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 font-serif mb-4">
                            For corporates, partnerships and trusts
                        </h3>
                        <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                            Why fill out multiple duplicative forms when you can fill out just one?
                            {BRAND.name} sources verified public information and allows you to
                            complete a single record with the additional information that your
                            relationships require.
                        </p>

                        <ul className="space-y-4 mb-8">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Massive efficiency gain: answer each question once</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Seamlessly coordinate data from internal teams and external providers</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Track progress towards completion</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Secure, sovereign control of your data</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                <span className="text-slate-700">Re-use data for multiple purposes and refresh processes</span>
                            </li>
                        </ul>

                        <div className="mt-auto pt-8">
                            <Button variant="outline" className="w-full sm:w-auto">
                                Get Started <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* For FIs */}
                    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 p-8 md:p-12 transition-all hover:shadow-xl flex flex-col">
                        <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center mb-8 border border-slate-700">
                            <Landmark className="h-6 w-6 text-white" />
                        </div>

                        <h3 className="text-2xl font-bold text-white font-serif mb-4">
                            For banks and other service providers
                        </h3>
                        <p className="text-slate-300 mb-8 text-lg leading-relaxed">
                            Partner with {BRAND.name} to map client data directly to your data
                            requirements:
                        </p>

                        <ul className="space-y-4 mb-8">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-slate-200">Eliminate relationship friction and delay caused by current onboarding and data collection processes</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-slate-200">Receive consistent verified data, including referenced and timestamped public sources</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-slate-200">Free up team resource for value-adding activity</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                                <span className="text-slate-200">Benchmark onboarding processes against industry-agreed standards</span>
                            </li>
                        </ul>

                        <div className="mt-auto pt-8">
                            <Button variant="gold" className="w-full sm:w-auto border border-transparent">
                                Partner with {BRAND.name} <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                </div>
                
                <div className="mt-16 text-center">
                    <p className="text-sm text-slate-500 mb-4">Want to understand the full picture first?</p>
                    <Button variant="premium" size="lg" className="h-14 px-8 text-lg w-full sm:w-auto transition-colors">
                        How it Works <MoveRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </section>
    );
}
