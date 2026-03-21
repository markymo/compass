"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import Image from "next/image";
import { motion } from "framer-motion";

import step1 from "@/assets/how-it-works/step-1.png";
import step2 from "@/assets/how-it-works/step-2.png";
import step3 from "@/assets/how-it-works/step-3.png";
import step4 from "@/assets/how-it-works/step-4.png";
import step5 from "@/assets/how-it-works/step-5.png";

const steps = [
    {
        number: "01",
        title: "Create your Legal Entity",
        description: "There is no complex setup. Simply input your entity’s legal name and national registry or Legal Entity Identifier. CoParity automatically populates publicly available information.",
        image: step1,
        color: "amber"
    },
    {
        number: "02",
        title: "Build your “Knowledge Base”",
        description: "Select suppliers from CoParity’s existing database, invite new suppliers, or upload data requirements yourself using our intuitive interface.",
        image: step2,
        color: "slate"
    },
    {
        number: "03",
        title: "Never repeat yourself",
        description: "As you work through your consolidated question list, CoParity learns and applies the responses to questions from other suppliers.",
        image: step3,
        color: "amber"
    },
    {
        number: "04",
        title: "Controlled verification and release",
        description: "With progress monitoring and separate permissions for response, verification and release, you can fully utilise internal and external teams whilst retaining full control.",
        image: step4,
        color: "slate"
    },
    {
        number: "05",
        title: "Preserve for the next time",
        description: "Update, verify and re-release your data at the touch of a button, when you start the next process or are asked for a refresh.",
        image: step5,
        color: "amber"
    }
];

export default function HowItWorks() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 pt-32 pb-16">
                <div className="container mx-auto px-4 md:px-6">
                    {/* Hero Section */}
                    <div className="mx-auto max-w-4xl text-center mb-24">
                        <motion.h1 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl font-bold tracking-tight text-slate-900 md:text-7xl mb-8 font-serif"
                        >
                            Client-Centric. Organic. Effortless.
                        </motion.h1>
                        <div className="space-y-4 text-xl md:text-2xl text-slate-600 leading-relaxed font-light">
                            <p>Stop filling out multiple compliance forms.</p>
                            <p>Stop maintaining &ldquo;Master Spreadsheets&rdquo;.</p>
                            <p className="font-medium text-slate-900">
                                {BRAND.name} builds your Knowledge Base automatically as you work.
                            </p>
                        </div>
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
                                        <span className="text-amber-500 font-bold tracking-widest uppercase text-sm">{BRAND.name} process &bull; STEP {step.number}</span>
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
                                Ready to stop the busywork?
                            </h3>
                            <Link href="/login">
                                <Button size="lg" className="h-16 px-12 text-xl bg-slate-900 text-white hover:bg-slate-800 transition-all font-semibold rounded-xl shadow-lg shadow-slate-900/10">
                                    Get Started <ArrowRight className="ml-2 h-6 w-6" />
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
