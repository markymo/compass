"use client";

import { Button } from "@/components/ui/button";
import { MoveRight } from "lucide-react";
import { motion } from "framer-motion";

export function Hero() {
    return (
        <section className="relative overflow-hidden pt-32 pb-16 md:pt-48 md:pb-32 bg-slate-50">

            {/* Subtle Background Elements */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-[600px] h-[600px] bg-slate-200/50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

            <div className="container relative mx-auto px-4 text-center md:px-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-900 shadow-sm mb-8">
                        The Standard for Capital Markets
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-5xl font-bold tracking-tight text-slate-900 md:text-7xl font-serif"
                >
                    Efficiency for Borrowers. <br />
                    <span className="text-amber-700">Clarity for Lenders.</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mx-auto mt-8 max-w-2xl text-xl text-slate-600 leading-relaxed font-light"
                >
                    Compass unifies the onboarding process with a single Master Schema.
                    We replace the chaos of duplicative forms with a streamlined, professional workflow.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
                >
                    <Button variant="premium" size="lg" className="h-14 px-8 text-lg w-full sm:w-auto">
                        View the Schema
                    </Button>
                    <Button variant="outline" size="lg" className="h-14 px-8 text-lg w-full sm:w-auto bg-white hover:bg-slate-50 border-slate-200 text-slate-900">
                        How it Works <MoveRight className="ml-2 h-4 w-4" />
                    </Button>
                </motion.div>
            </div>
        </section>
    );
}
