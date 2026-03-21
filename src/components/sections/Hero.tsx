"use client";

import { Button } from "@/components/ui/button";
import { MoveRight } from "lucide-react";
import { motion } from "framer-motion";
import { BRAND } from "@/config/brand";

export function Hero() {
    return (
        <section className="relative overflow-hidden pt-32 pb-16 md:pt-48 md:pb-32 bg-slate-50">

            {/* Subtle Background Elements */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-[600px] h-[600px] bg-slate-200/50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            {/* Amber gradient bleed into next section */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-amber-50/60 to-transparent pointer-events-none"></div>

            <div className="container relative mx-auto px-4 text-center md:px-6">
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="mx-auto text-center text-5xl font-bold tracking-tight text-slate-900 md:text-8xl font-serif"
                >
                    Co<span className="text-amber-500">Parity</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mx-auto mt-8 max-w-2xl text-xl text-slate-600 leading-relaxed font-light"
                >
                    {BRAND.name} is a Single Source of Truth for company data.
                    Replace the chaos of emailed information responses with a streamlined, professional workflow.
                </motion.p>


            </div>
        </section >
    );
}
