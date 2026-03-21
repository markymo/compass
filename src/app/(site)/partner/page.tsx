"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { motion } from "framer-motion";
import { BRAND } from "@/config/brand";

import step1 from "@/assets/partner/step-1.png";
import step2 from "@/assets/partner/step-2.png";
import step3 from "@/assets/partner/step-3.png";
import step4 from "@/assets/partner/step-4.png";
import step5 from "@/assets/partner/step-5.png";

const steps = [
    {
        number: "01",
        title: "Upload your requirements",
        description: "Upload a set of information requirements to CoParity (for example – UK large corporates).",
        image: step1,
        color: "amber"
    },
    {
        number: "02",
        title: "Seamless integration",
        description: "CoParity integrates your data requirements into its standard data set, expanding it if necessary.",
        image: step2,
        color: "slate"
    },
    {
        number: "03",
        title: "Team & Permissions",
        description: "Instantly add team members and manage permissions for each client engagement.",
        image: step3,
        color: "amber"
    },
    {
        number: "04",
        title: "Real-time sign off",
        description: "Review and sign off client responses as they come in.",
        image: step4,
        color: "slate"
    },
    {
        number: "05",
        title: "Effortless refresh",
        description: "Clients can re-verify and refresh at the press of a key: no need to compromise your refresh requirements.",
        image: step5,
        color: "amber"
    }
];

export default function PartnerPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 pt-32 pb-16">
                <div className="container mx-auto px-4 md:px-6">
                    {/* Hero Section */}
                    <div className="mx-auto max-w-4xl text-center mb-24">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-sm font-medium mb-8"
                        >
                            <Sparkles className="h-4 w-4" />
                            <span>PARTNER COLLABORATION</span>
                        </motion.div>
                        <motion.h1 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl font-bold tracking-tight text-slate-900 md:text-7xl mb-8 font-serif"
                        >
                            Geared to clients&rsquo; needs&hellip; and yours
                        </motion.h1>
                        <motion.p 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-xl md:text-2xl text-slate-600 leading-relaxed font-light max-w-3xl mx-auto"
                        >
                            {BRAND.name} improves data accuracy and verification, reduces
                            onboarding time, strengthens client relationships and frees your front
                            office and onboarding specialists for value-adding activity.
                        </motion.p>
                    </div>

                    {/* Step-by-Step Sections */}
                    <div className="space-y-32 md:space-y-48">
                        {steps.map((step, index) => (
                            <div 
                                key={step.number} 
                                className={`flex flex-col items-center gap-12 lg:gap-24 ${index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"}`}
                            >
                                <div className="flex-1 space-y-8">
                                    <div className="space-y-4">
                                        <span className="text-amber-500 font-bold tracking-widest uppercase text-sm">PARTNER WORKFLOW &bull; STEP {step.number}</span>
                                        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 font-serif leading-tight">
                                            {step.title}
                                        </h2>
                                    </div>
                                    <p className="text-xl text-slate-600 leading-relaxed font-light">
                                        {step.description}
                                    </p>
                                </div>
                                <div className="flex-1 w-full relative">
                                    <div className={`absolute -inset-4 rounded-[2rem] blur-2xl opacity-10 pointer-events-none ${step.color === "amber" ? "bg-amber-500" : "bg-slate-400"}`}></div>
                                    <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden aspect-video group">
                                         <Image 
                                            src={step.image} 
                                            alt={step.title}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Final CTA */}
                    <div className="mt-48 text-center py-32 px-4 rounded-3xl bg-slate-50 border border-slate-100">
                        <div className="max-w-2xl mx-auto space-y-10">
                            <h3 className="text-3xl md:text-5xl font-bold font-serif text-slate-900 leading-tight">
                                Ready to collaborate?
                            </h3>
                            <Link href={`mailto:${BRAND.email}`}>
                                <Button size="lg" className="h-16 px-12 text-xl bg-slate-900 text-white hover:bg-slate-800 transition-all font-semibold rounded-xl shadow-lg shadow-slate-900/10">
                                    Contact us <ArrowRight className="ml-2 h-6 w-6" />
                                </Button>
                            </Link>
                        </div>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}
