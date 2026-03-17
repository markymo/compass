"use client";

import { AlertCircle, CheckCircle2, FileJson, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { BRAND } from "@/config/brand";

const features = [
    {
        icon: <Zap className="h-6 w-6 text-amber-600" />,
        title: "Infinite Flexibility",
        description: "CoParity flexes to accommodate new information requirements arising from different geographies, sectors and products.",
    },
    {
        icon: <Shield className="h-6 w-6 text-slate-700" />,
        title: "Secure & Sovereign",
        description: "Your data is ring-fenced. You control exactly what information is output to each supplier organisation, at field level.",
    },
    {
        icon: <Zap className="h-6 w-6 text-amber-600" />,
        title: "Instant Distribution",
        description: "Instantly verify and release data as it's available, in the preferred format of the recipient – whether that's PDF, Excel, Word or direct API integration.",
    },
];

export function Features() {
    return (
        <section className="bg-slate-50 py-24 relative">
            <div className="container mx-auto px-4 md:px-6">

                <div className="mb-16 text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-serif sm:text-4xl">
                        Why Capital Markets Needed a Reset
                    </h2>
                    <p className="mt-4 text-lg text-slate-600">
                        The current onboarding process is broken. We fixed it.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
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
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
                                    <span>Duplicative emails from each institution</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
                                    <span>Inconsistent questions & interpretation</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
                                    <span>Manual or no process tracking</span>
                                </li>
                            </ul>
                        </div>
                        <div className="space-y-6">
                            <h3 className="text-2xl font-bold text-slate-900 font-serif flex items-center gap-2">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600" /> CoParity's Approach
                            </h3>
                            <ul className="space-y-4 text-slate-700">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                    <span className="font-medium">Single Source of Truth, pre-populated from public sources</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                    <span className="font-medium">Full visibility & control</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                    <span className="font-medium">Auditable, permission-based sharing</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}
