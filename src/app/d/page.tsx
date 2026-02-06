import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export default function ExperimentalPage() {
    return (
        <div className="flex flex-col">

            {/* SECTION 1: HERO - Minimalist, High Authority */}
            <section className="relative min-h-screen flex flex-col justify-center px-6 md:px-12 pt-20 border-b border-white/5">
                <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">

                    {/* Left: Typography */}
                    <div className="space-y-8">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
                            The Standard for <br />
                            <span className="text-teal-500">Sovereign Identity.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-slate-400 max-w-lg font-light leading-relaxed">
                            Streamlining corporate debt finance onboarding with a single source of truth. Precision, privacy, and speed.
                        </p>

                        <div className="pt-8 flex flex-wrap gap-4">
                            <button className="group px-8 py-4 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-none flex items-center gap-2 transition-all">
                                Request Access
                                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className="px-8 py-4 border border-white/20 hover:border-white text-white font-medium rounded-none transition-all">
                                View Documentation
                            </button>
                        </div>
                    </div>

                    {/* Right: Abstract Visual (Placeholder for potential 3D/Video) */}
                    <div className="relative aspect-square lg:aspect-[4/3] bg-gradient-to-br from-slate-900 to-black border border-white/10 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(0,163,150,0.15),transparent_70%)]" />
                        <div className="text-slate-700 font-mono text-sm tracking-widest uppercase">
                            [ Interactive Visual System ]
                        </div>
                        {/* Decorative grid lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
                    </div>
                </div>
            </section>

            {/* SECTION 2: THE SPLIT - "Quiet Luxury" Style */}
            <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[80vh]">
                {/* Image Side */}
                <div className="relative bg-teal-950/20 border-r border-white/5 order-2 lg:order-1 min-h-[400px]">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ShieldCheck className="h-32 w-32 text-teal-500/20" />
                    </div>
                </div>

                {/* Content Side */}
                <div className="flex flex-col justify-center px-12 py-24 order-1 lg:order-2">
                    <span className="text-teal-500 font-mono text-xs uppercase tracking-widest mb-6">/ Security First</span>
                    <h2 className="text-4xl md:text-5xl font-bold mb-8">Uncompromising Data Sovereignty.</h2>
                    <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-md">
                        Your data never leaves your control until you explicitly grant access. Compass utilizes advanced permissioning architectures to ensure you remain the sole custodian of your corporate identity.
                    </p>
                    <ul className="space-y-4">
                        {[
                            "Role-Based Access Control",
                            "Granular Field-Level Permissions",
                            "Audit-Ready Logs"
                        ].map((item) => (
                            <li key={item} className="flex items-center gap-3 text-slate-300">
                                <CheckCircle2 className="h-5 w-5 text-teal-500" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* SECTION 3: THE METRICS - Minimalist Stats */}
            <section className="py-32 px-6 md:px-12 border-t border-white/5 bg-neutral-950">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
                    {[
                        { label: "Onboarding Time", value: "-85%", desc: "Reduction in processing" },
                        { label: "Data Accuracy", value: "100%", desc: "Verified source of truth" },
                        { label: "Global Reach", value: "24/7", desc: "Always-on availability" }
                    ].map((stat) => (
                        <div key={stat.label} className="border-l border-teal-500/30 pl-8">
                            <div className="text-6xl font-bold text-white mb-2">{stat.value}</div>
                            <div className="text-xl text-teal-500 font-medium mb-1">{stat.label}</div>
                            <div className="text-slate-500 text-sm">{stat.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION 4: CALL TO ACTION - Centered */}
            <section className="py-40 px-6 text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to redefine your infrastructure?</h2>
                    <p className="text-xl text-slate-400 mb-12">Join the leading financial institutions using Compass.</p>
                    <button className="px-12 py-5 bg-white text-black font-bold text-lg hover:bg-slate-200 transition-colors">
                        Start Integration
                    </button>
                </div>
            </section>

        </div>
    );
}
