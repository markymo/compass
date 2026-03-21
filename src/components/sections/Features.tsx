"use client";

import { AlertCircle, CheckCircle2, Shield, Zap, UserCheck, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { BRAND } from "@/config/brand";

const features = [
    {
        icon: <UserCheck className="h-6 w-6 text-amber-600" />,
        title: "Client-centric",
        description: `${BRAND.name} the first client-centric onboarding system, aimed primarily at KYC and onboarding processes for corporate clients.`,
    },
    {
        icon: <Zap className="h-6 w-6 text-slate-700" />,
        title: "Infinite Flexibility",
        description: `${BRAND.name} flexes to accommodate new information requirements arising from different geographies, sectors and products.`,
    },
    {
        icon: <Shield className="h-6 w-6 text-amber-600" />,
        title: "Secure & Sovereign",
        description: "Your data is ring-fenced. You control exactly what information is output to each supplier organisation, at field level.",
    },
    {
        icon: <Share2 className="h-6 w-6 text-slate-700" />,
        title: "Instant Distribution",
        description: "Instantly verify and release data as its available, in the preferred format of the recipient – whether that's PDF, Excel, Word or direct API integration.",
    },
];

export function Features() {
    return (
        <section className="bg-slate-50 py-24 relative">
            <div className="container mx-auto px-4 md:px-6">

                <div className="mb-16 max-w-3xl mx-auto">
                    <blockquote className="border-l-4 border-amber-500 pl-6">
                        <p className="text-2xl font-bold tracking-tight text-slate-900 font-serif sm:text-3xl leading-snug italic">
                            &ldquo;The average onboarding process for a new corporate client can take
                            up to 100 days and varies significantly depending on the banking
                            products and geographies involved.&rdquo;
                        </p>
                        <footer className="mt-3 text-sm font-normal text-slate-500">&mdash; McKinsey &amp; Company</footer>
                    </blockquote>
                    <p className="mt-8 text-lg text-slate-600 leading-relaxed">
                        The current onboarding process is broken. Bank systems, whilst
                        improving, are intrinsically unable to resolve the key difficulty of
                        similar information requirements across multiple banking and other
                        relationships.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                    {features.map((feature: any, index: any) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 hover:border-slate-300 hover:shadow-lg transition-all"
                        >
                            <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-slate-100 p-3 group-hover:bg-slate-200 transition-colors">
                                {feature.icon}
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-slate-900 font-serif">{feature.title}</h3>
                            <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Comparison Section */}
                <div className="mt-24 rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 p-8 md:p-12">
                    <div className="grid gap-12 lg:grid-cols-2">
                        <div className="space-y-6">
                            <h3 className="text-2xl font-bold text-red-600 font-serif flex items-center gap-2">
                                <AlertCircle className="h-6 w-6" /> Conventional Processes
                            </h3>
                            <ul className="space-y-4 text-slate-600">
                                <li className="flex items-start gap-3">
                                    <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-red-500/70" />
                                    <span>Duplicative emails from each institution</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-red-500/70" />
                                    <span>Inconsistent questions &amp; interpretation</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-red-500/70" />
                                    <span>Manual or no process tracking</span>
                                </li>
                            </ul>
                        </div>
                        <div className="space-y-6">
                            <h3 className="text-2xl font-bold text-slate-900 font-serif flex items-center gap-2">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600" /> {BRAND.name}&apos;s Approach
                            </h3>
                            <ul className="space-y-4 text-slate-700">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                    <span className="font-medium">Single Source of Truth, pre-populated from public sources</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                    <span className="font-medium">Full visibility &amp; control</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                    <span className="font-medium">Auditable, permission-based sharing</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Features CTA */}
                <div className="mt-16 rounded-2xl bg-amber-50 border border-amber-100 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <p className="text-lg font-semibold text-slate-900 font-serif">See {BRAND.name} in action</p>
                        <p className="text-slate-600 mt-1">Take a guided walkthrough and discover how it works end-to-end.</p>
                    </div>
                    <a href="/how-it-works" className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
                        See how it works &rarr;
                    </a>
                </div>

            </div>
        </section>
    );
}
