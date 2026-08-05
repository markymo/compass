"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sparkles, Power, Circle, AlignLeft, ArrowUpRight, FlipHorizontal } from "lucide-react";

export default function LogoPreviewPage() {
    const [selectedOption, setSelectedOption] = useState<"a1_mirrored" | "a1" | "a2" | "a3" | "a4">("a1_mirrored");

    const variations = [
        {
            id: "a1_mirrored",
            name: "A1 (Mirrored): The Power 'P' Mark ⭐",
            subtitle: "Upper-left gap with right-side 'P' loop intact",
            icon: FlipHorizontal,
            light: "/logo-v2-a1-mirrored.svg",
            dark: "/logo-v2-a1-mirrored-inverted.svg",
            description: "By mirroring A1 across the N-S axis, the notch moves to the upper-left, leaving a solid curved loop on the right of the vertical orange stem. This forms an unmistakable, elegant capital 'P' while preserving the power switch ('ON') and circle ('O')!",
            isFeatured: true,
        },
        {
            id: "a1",
            name: "A1 (Original): Top-Right Slot",
            subtitle: "Upper-right gap with vertical power stem",
            icon: Power,
            light: "/logo-v2-a1.svg",
            dark: "/logo-v2-a1-inverted.svg",
            description: "The original A1 with the notch at the top-right and vertical orange stem.",
            isFeatured: false,
        },
        {
            id: "a2",
            name: "A2: Tangent Left Spine",
            subtitle: "Left vertical 'P' spine fused with open 'O' arc",
            icon: AlignLeft,
            light: "/logo-v2-a2.svg",
            dark: "/logo-v2-a2-inverted.svg",
            description: "The orange stem forms the full vertical spine on the left edge.",
            isFeatured: false,
        },
        {
            id: "a3",
            name: "A3: 45° Radial Pulse",
            subtitle: "Dynamic 300° ring with diagonal pulse stroke",
            icon: ArrowUpRight,
            light: "/logo-v2-a3.svg",
            dark: "/logo-v2-a3-inverted.svg",
            description: "An angled power stroke emanating from the center out through a 45-degree top-right gap.",
            isFeatured: false,
        },
        {
            id: "a4",
            name: "A4: Floating Power Pin",
            subtitle: "Classic Power Icon geometry (O ring + top pin)",
            icon: Circle,
            light: "/logo-v2-a4.svg",
            dark: "/logo-v2-a4-inverted.svg",
            description: "A clean circle ring with a floating vertical orange activation pin at top.",
            isFeatured: false,
        },
    ];

    const currentActive = variations.find((v) => v.id === selectedOption) || variations[0];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-10">
                {/* Header Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" /> Breakthrough Revision: Mirrored A1
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-white">OnPro Logo Studio: A1 Mirrored</h1>
                        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                            Flipping A1 on the North-South axis creates a natural capital <span className="text-amber-400 font-bold">&apos;P&apos;</span> loop on the right while maintaining the universal <span className="text-white font-bold">&apos;ON&apos;</span> power symbol &amp; <span className="text-white font-bold">&apos;O&apos;</span> ring!
                        </p>
                    </div>

                    <Link
                        href="/"
                        className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Return to App
                    </Link>
                </div>

                {/* Variation Selection Grid */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" /> Select Mark Version
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {variations.map((varOption) => {
                            const IconComponent = varOption.icon;
                            const isSelected = selectedOption === varOption.id;
                            return (
                                <button
                                    key={varOption.id}
                                    onClick={() => setSelectedOption(varOption.id as any)}
                                    className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                                        isSelected
                                            ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-lg"
                                            : "border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70"
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className={`p-2 rounded-xl ${isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-amber-400"}`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                            {isSelected && (
                                                <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Active
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-white text-xs leading-tight">{varOption.name}</h3>
                                    </div>

                                    {/* Preview Thumbnail */}
                                    <div className="bg-white rounded-xl p-2 flex items-center justify-center h-14 shadow-inner">
                                        <img src={varOption.light} alt={varOption.name} className="h-9 w-auto" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Active Selection Details & Live Mockups */}
                <div className="space-y-6 pt-4 border-t border-slate-800">
                    <div className="bg-gradient-to-r from-amber-500/15 via-slate-800/80 to-slate-800/60 border border-amber-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <span className="text-xs text-amber-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" /> Concept Breakdown
                            </span>
                            <h3 className="text-2xl font-extrabold text-white">{currentActive.name}</h3>
                            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">{currentActive.description}</p>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-center min-w-[200px]">
                            <img src={currentActive.light} alt="Focus Logo" className="h-12 w-auto" />
                        </div>
                    </div>

                    {/* Header Navbar Mockup */}
                    <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
                        <div className="bg-slate-800/60 px-4 py-2 border-b border-slate-800 text-xs text-slate-400 font-mono flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                            </div>
                            <span>Navbar Preview (Light Background)</span>
                        </div>

                        <div className="bg-white p-4 md:px-8 flex items-center justify-between border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <img src={currentActive.light} alt="Navbar Logo" className="h-11 w-auto" />
                            </div>

                            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                                <span className="text-slate-900 font-semibold">How it Works</span>
                                <span>Partner</span>
                                <span>About</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">Sign In</span>
                                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white shadow-sm">Get Started</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Mockup */}
                    <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
                        <div className="bg-slate-800/60 px-4 py-2 border-b border-slate-800 text-xs text-slate-400 font-mono flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                            </div>
                            <span>Footer Preview (Dark Background)</span>
                        </div>

                        <div className="bg-slate-900 p-6 md:p-10 border-t border-slate-800">
                            <div className="grid md:grid-cols-4 gap-8">
                                <div className="md:col-span-2 space-y-3">
                                    <img src={currentActive.dark} alt="Footer Logo" className="h-9 w-auto" />
                                    <p className="text-sm font-semibold text-slate-200">Professional Onboarding</p>
                                    <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                                        The Single Source of Truth for company data and corporate verification.
                                    </p>
                                </div>
                                <div className="space-y-2 text-xs text-slate-400">
                                    <p className="font-semibold text-white uppercase tracking-wider mb-2">Product</p>
                                    <p>How it Works</p>
                                    <p>Partner Platform</p>
                                </div>
                                <div className="space-y-2 text-xs text-slate-400">
                                    <p className="font-semibold text-white uppercase tracking-wider mb-2">Legal</p>
                                    <p>Privacy Policy</p>
                                    <p>Terms of Service</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
