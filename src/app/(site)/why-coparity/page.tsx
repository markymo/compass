import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BRAND } from "@/config/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `Why "${BRAND.name}"? | ${BRAND.name}`,
    description: "The story behind our name.",
};

export default function WhyCoparity() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 pt-32 pb-24">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="mx-auto max-w-3xl">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl mb-12 text-center font-serif">
                            Why &ldquo;{BRAND.name}&rdquo;?
                        </h1>

                        <div className="prose prose-lg text-slate-600 mx-auto text-center mb-16">
                            <p className="text-2xl font-medium leading-relaxed">
                                <strong className="text-amber-600">Co</strong> stands for <strong className="text-slate-900">Company</strong>.
                            </p>
                            <p className="text-2xl font-medium leading-relaxed mt-4">
                                But the heart of the name is <strong className="text-slate-900">Parity</strong>.
                            </p>
                        </div>

                        <div className="space-y-8 my-16">
                            <div className="relative p-8 md:p-10 border border-slate-200 rounded-xl bg-slate-50 shadow-sm mx-auto max-w-2xl group">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-xl opacity-75"></div>
                                <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Parity</h3>
                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">noun</p>
                                <p className="text-xl text-slate-700 italic font-serif leading-relaxed">
                                    The state or condition of being equal, equivalent, or corresponding.
                                </p>
                            </div>

                            <div className="relative p-8 md:p-10 border border-slate-200 rounded-xl bg-slate-50 shadow-sm mx-auto max-w-2xl group">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl opacity-75"></div>
                                <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Parity</h3>
                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">noun, computing / data transmission</p>
                                <p className="text-xl text-slate-700 italic font-serif leading-relaxed">
                                    A binary error-checking method. A parity bit is added to a string of data to ensure the total number of 1-bits is always even or always odd, making data corruption easier to detect.
                                </p>
                            </div>
                        </div>

                        <div className="prose prose-lg text-slate-600 mx-auto">
                            <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center leading-snug">
                                {BRAND.name} exists to create parity between parties that need to trust the same company data.
                            </h2>
                            <p className="text-lg leading-relaxed text-slate-600 mt-8 text-center max-w-2xl mx-auto">
                                Every organisation involved in onboarding, verifying, or maintaining a company record often holds a slightly different version of the truth. {BRAND.name} helps bring those versions into alignment — creating a shared, trusted view of company data while preserving governance, auditability, and control.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
