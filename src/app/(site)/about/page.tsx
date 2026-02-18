import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function About() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 pt-32 pb-16">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="mx-auto max-w-3xl">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl mb-8">
                            About ONpro
                        </h1>

                        <div className="prose prose-lg text-slate-600">
                            <p>
                                ONpro was born from a simple observation: <strong>Complexity in capital markets is often artificial.</strong>
                            </p>
                            <p>
                                When corporate entities raise senior debt finance, the "onboarding" process creates massive friction.
                                A single client might interact with 20 different financial institutions, each asking the same
                                questions in slightly different ways.
                            </p>
                            <p>
                                We believe there is a better way. By creating a unified <strong>Master Schema</strong> for
                                onboarding data, we can eliminate duplication, reduce errors, and dramatically speed up
                                time-to-execution for deals.
                            </p>
                        </div>
                    </div>

                    <div className="mx-auto max-w-4xl mt-24">
                        <div className="mb-12 border-t border-slate-200" />

                        <div className="grid gap-12 md:grid-cols-[300px_1fr] items-start">
                            <div className="relative group">
                                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 opacity-50 blur-lg group-hover:opacity-75 transition duration-500"></div>
                                <img
                                    src="/images/rob_stylized_orange.png"
                                    alt="Rob Dornton-Duff"
                                    className="relative rounded-xl shadow-lg border border-slate-200 w-full object-cover aspect-[3/4]"
                                />
                            </div>

                            <div>
                                <h2 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-2">Co-Founder</h2>
                                <h3 className="text-3xl font-bold text-slate-900 font-serif mb-6">Rob Dornton-Duff</h3>

                                <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
                                    <p>
                                        Rob brings over 20 years of experience in derivatives markets to ONpro, with a specialized focus on infrastructure, structured trade, and export finance..
                                    </p>
                                    <p>
                                        Before establishing Riskbridge in 2017, Rob was a Managing Director at <strong>Chatham Financial</strong>, where he founded and led the Global Infrastructure and Project Finance Advisory Team. Previously, as a Director at <strong>Barclays Capital</strong>, he led derivatives coverage for the Infrastructure and PFI/PPP sectors.
                                    </p>
                                    <p>
                                        He has overseen hedging processes for more than <strong>£40bn</strong> of infrastructure debt issuance, executing some of the largest trades in the market. It is this deep operational experience that drives the ONpro mission: to eliminate the administrative overhead that burdens modern capital markets.
                                    </p>
                                    <p className="text-sm text-slate-500 pt-4 font-medium">
                                        MBA, Manchester Business School • Aeronautical Engineering, Imperial College
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="my-12 border-t border-slate-200" />

                        <div className="grid gap-12 md:grid-cols-[300px_1fr] items-start">
                            <div className="relative group">
                                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tl from-slate-200 to-slate-100 opacity-50 blur-lg group-hover:opacity-75 transition duration-500"></div>
                                <img
                                    src="/images/mark_stylized.png"
                                    alt="Mark Lissaman"
                                    className="relative rounded-xl shadow-lg border border-slate-200 w-full object-cover aspect-[3/4]"
                                />
                            </div>

                            <div>
                                <h2 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-2">Co-Founder</h2>
                                <h3 className="text-3xl font-bold text-slate-900 font-serif mb-6">Mark Lissaman</h3>

                                <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
                                    <p>
                                        Mark combines deep technical expertise with a strategic vision for financial infrastructure. As a veteran of complex systems architecture, he oversees the engineering philosophy that makes ONpro secure, scalable, and intuitive.
                                    </p>
                                    <p>
                                        With a background spanning enterprise software and fintech innovation, Mark identified the critical data disconnects in traditional banking workflows. His focus is on building "sovereign identity" architectures—systems where clients retain absolute control over their data while facilitating seamless institutional access.
                                    </p>
                                    <p>
                                        He leads the product and engineering teams at ONpro, ensuring that every line of code serves the dual mandate of <strong>uncompromising security</strong> and <strong>radical efficiency</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
