"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sparkles, Shield, Terminal, Globe, Server } from "lucide-react";

export default function LogoPreviewPage() {
    const [selectedEnv, setSelectedEnv] = useState<"prod" | "dev" | "staging">("prod");

    const environments = [
        {
            id: "prod",
            name: "Production Environment",
            badge: "Primary Brand Identity",
            accent: "Orange (#F97316)",
            icon: Globe,
            light: "/logo.svg",
            dark: "/logo-inverted.svg",
            favicon: "/icon.svg",
            bgClass: "border-amber-500/50 bg-amber-500/10",
        },
        {
            id: "dev",
            name: "Local Development / Localhost",
            badge: "Dev Safety Indicator",
            accent: "Dev Green (#16A34A)",
            icon: Terminal,
            light: "/logo-dev.svg",
            dark: "/logo-inverted-dev.svg",
            favicon: "/icon-dev.svg",
            bgClass: "border-green-500/50 bg-green-500/10",
        },
        {
            id: "staging",
            name: "Staging Environment",
            badge: "Staging Safety Indicator",
            accent: "Staging Purple (#9333EA)",
            icon: Server,
            light: "/logo-staging.svg",
            dark: "/logo-inverted-staging.svg",
            favicon: "/icon-staging.svg",
            bgClass: "border-purple-500/50 bg-purple-500/10",
        },
    ];

    const currentEnv = environments.find((e) => e.id === selectedEnv) || environments[0];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-10">
                {/* Header Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Migration Complete
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-white">OnPro Official Brand &amp; Environment Suite</h1>
                        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                            The new <span className="text-amber-400 font-bold">A1 Mirrored (&quot;Power P&quot;)</span> mark is now fully deployed across Production, Dev, and Staging environments.
                        </p>
                    </div>

                    <Link
                        href="/"
                        className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Return to App
                    </Link>
                </div>

                {/* Environment Selector Grid */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" /> Environment Brand Suite
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {environments.map((env) => {
                            const IconComponent = env.icon;
                            const isSelected = selectedEnv === env.id;
                            return (
                                <button
                                    key={env.id}
                                    onClick={() => setSelectedEnv(env.id as any)}
                                    className={`text-left p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                                        isSelected
                                            ? `${env.bgClass} ring-2 ring-amber-500/30 shadow-lg`
                                            : "border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70"
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2.5 rounded-xl ${isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                                                <IconComponent className="w-5 h-5" />
                                            </div>
                                            {isSelected && (
                                                <span className="text-xs font-extrabold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-white text-lg">{env.name}</h3>
                                        <p className="text-xs text-slate-400 mt-1">{env.badge} &bull; {env.accent}</p>
                                    </div>

                                    {/* Preview Thumbnail */}
                                    <div className="bg-white rounded-xl p-4 flex items-center justify-center h-20 shadow-inner">
                                        <img src={env.light} alt={env.name} className="h-12 w-auto" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Active Selection Details & Live Mockups */}
                <div className="space-y-6 pt-4 border-t border-slate-800">
                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Active Environment</span>
                            <h3 className="text-xl font-bold text-white">{currentEnv.name}</h3>
                            <p className="text-xs text-slate-300 mt-1">Accent: {currentEnv.accent}</p>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-center min-w-[200px]">
                            <img src={currentEnv.light} alt="Active Logo" className="h-12 w-auto" />
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
                            <span>Navbar Preview ({currentEnv.name})</span>
                        </div>

                        <div className="bg-white p-4 md:px-8 flex items-center justify-between border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <img src={currentEnv.light} alt="Navbar Logo" className="h-11 w-auto" />
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
                            <span>Footer Preview ({currentEnv.name})</span>
                        </div>

                        <div className="bg-slate-900 p-6 md:p-10 border-t border-slate-800">
                            <div className="grid md:grid-cols-4 gap-8">
                                <div className="md:col-span-2 space-y-3">
                                    <img src={currentEnv.dark} alt="Footer Logo" className="h-9 w-auto" />
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
