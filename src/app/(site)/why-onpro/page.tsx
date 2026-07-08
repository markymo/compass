import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BRAND } from "@/config/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `Why "${BRAND.name}"? | ${BRAND.name}`,
    description: "The story behind our name.",
};

export default function WhyOnPro() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            
            <main className="flex-1 pt-32 pb-32 bg-white text-black">
                <div className="container mx-auto px-6 md:px-12 max-w-4xl">
                    
                    {/* Header */}
                    <div className="mb-24">
                        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-8">
                            Why &ldquo;{BRAND.name}&rdquo;?
                        </h1>
                        <p className="text-xl md:text-2xl font-light text-neutral-600 leading-relaxed max-w-2xl">
                            We believe company data shouldn't be fragmented.
                        </p>
                    </div>

                    {/* Breakdown */}
                    <div className="border-t border-b border-black py-16 my-16 space-y-16">
                        
                        {/* ON */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                            <div className="md:col-span-1">
                                <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-amber-600">
                                    On
                                </h2>
                            </div>
                            <div className="md:col-span-2">
                                <h3 className="text-2xl font-serif font-bold mb-4">Onboarding</h3>
                                <p className="text-lg text-neutral-600 font-light leading-relaxed">
                                    Streamlined, frictionless workflows to connect your clients and suppliers instantly.
                                </p>
                            </div>
                        </div>

                        {/* PRO */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                            <div className="md:col-span-1">
                                <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-amber-600">
                                    Pro
                                </h2>
                            </div>
                            <div className="md:col-span-2">
                                <h3 className="text-2xl font-serif font-bold mb-4">Professionally</h3>
                                <p className="text-lg text-neutral-600 font-light leading-relaxed">
                                    Built with uncompromising governance, auditability, and trust at its core.
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* Conclusion */}
                    <div className="pt-8">
                        <h2 className="text-2xl md:text-3xl font-serif font-bold mb-6">
                            A single source of truth for company data.
                        </h2>
                        <p className="text-lg text-neutral-600 font-light leading-relaxed max-w-3xl">
                            Every organisation involved in onboarding, verifying, or maintaining a company record deals with friction. {BRAND.name} brings those fragmented versions into alignment, creating a shared, trusted workflow.
                        </p>
                    </div>

                </div>
            </main>
            
            <Footer />
        </div>
    );
}
