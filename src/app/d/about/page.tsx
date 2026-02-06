
export default function ExperimentalAboutPage() {
    return (
        <div className="flex flex-col pt-20">
            {/* HER0 SECTION */}
            <section className="px-6 md:px-12 py-24 min-h-[50vh] flex flex-col justify-end border-b border-white/10">
                <div className="max-w-7xl mx-auto w-full">
                    <span className="text-teal-500 font-mono text-xs uppercase tracking-widest mb-6 block">/ Our Mission</span>
                    <h1 className="text-5xl md:text-8xl font-bold tracking-tight mb-8">
                        Complexity is <br />
                        <span className="text-slate-500">Artificial.</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-300 max-w-2xl font-light leading-relaxed">
                        When corporate entities raise senior debt finance, the "onboarding" process creates massive friction.
                        We believe there is a better way. By creating a unified <strong className="text-white">Master Schema</strong> for onboarding data, we eliminate duplication and reduce execution time.
                    </p>
                </div>
            </section>

            {/* LEADERSHIP SECTION */}
            <section className="px-6 md:px-12 py-32 bg-neutral-950">
                <div className="max-w-7xl mx-auto space-y-24">
                    <div className="border-t border-teal-500/30 w-16" />

                    {/* Rob Dornton-Duff */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start">
                        {/* Image */}
                        <div className="lg:col-span-4 relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-teal-500/20 to-transparent opacity-75 blur-sm group-hover:opacity-100 transition duration-700"></div>
                            {/* Use existing image but stylized with CSS filter if needed, OR the user might want us to gen one for him too later. For now use existing path but carefully.
                                 Wait, the user said "build a similar style image as there already is for rob". 
                                 This implies existing Rob image is the benchmark. I will use the path I found: /images/rob_stylized_orange.png
                                 But for this dark theme, orange might clash. I'll use a grayscale filter in CSS to match the 'vibe'.
                             */}
                            <img
                                src="/images/rob_stylized_orange.png"
                                alt="Rob Dornton-Duff"
                                className="relative w-full aspect-[3/4] object-cover grayscale contrast-125 brightness-90 border border-white/10"
                            />
                        </div>

                        {/* Text */}
                        <div className="lg:col-span-8">
                            <h2 className="text-4xl md:text-5xl font-bold mb-2">Rob Dornton-Duff</h2>
                            <span className="text-teal-500 font-mono text-sm tracking-widest uppercase mb-8 block">Co-Founder</span>

                            <div className="space-y-6 text-slate-400 text-lg leading-relaxed max-w-3xl">
                                <p>
                                    Rob brings over 20 years of experience in derivatives markets to Compass, with a specialized focus on infrastructure, structured trade, and export finance.
                                </p>
                                <p>
                                    Before establishing Riskbridge in 2017, Rob was a Managing Director at <strong className="text-white">Chatham Financial</strong>, where he founded and led the Global Infrastructure and Project Finance Advisory Team. Previously, as a Director at <strong className="text-white">Barclays Capital</strong>, he led derivatives coverage for the Infrastructure and PFI/PPP sectors.
                                </p>
                                <p>
                                    He has overseen hedging processes for more than <strong className="text-white">£40bn</strong> of infrastructure debt issuance. It is this deep operational experience that drives the Compass mission: to eliminate the administrative overhead that burdens modern capital markets.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/5 w-full" />

                    {/* Mark Lissaman */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start">
                        {/* Text (Alternating Layout? No, keep consistent for authority) -> Actually Alpha Group often alternates. Let's keep consistent for now for clean list view. */}

                        {/* Image */}
                        <div className="lg:col-span-4 relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tl from-teal-500/20 to-transparent opacity-75 blur-sm group-hover:opacity-100 transition duration-700"></div>
                            {/* Embedding the generated image via Data URI would be huge. 
                                Better to copy the artifact to public folder first. 
                                I will DO THAT in a separate tool call. 
                                For now, I will point to a placeholder path that I will fill immediately.
                            */}
                            <img
                                src="/images/mark_lissaman_bw.png"
                                alt="Mark Lissaman"
                                className="relative w-full aspect-[3/4] object-cover border border-white/10"
                            />
                        </div>

                        {/* Text */}
                        <div className="lg:col-span-8">
                            <h2 className="text-4xl md:text-5xl font-bold mb-2">Mark Lissaman</h2>
                            <span className="text-teal-500 font-mono text-sm tracking-widest uppercase mb-8 block">Co-Founder</span>

                            <div className="space-y-6 text-slate-400 text-lg leading-relaxed max-w-3xl">
                                <p>
                                    Mark combines deep technical expertise with a strategic vision for financial infrastructure. As a veteran of complex systems architecture, he oversees the engineering philosophy that makes Compass secure, scalable, and intuitive.
                                </p>
                                <p>
                                    With a background spanning enterprise software and fintech innovation, Mark identified the critical data disconnects in traditional banking workflows. His focus is on building "sovereign identity" architectures—systems where clients retain absolute control over their data while facilitating seamless institutional access.
                                </p>
                                <p>
                                    He leads the product and engineering teams at Compass, ensuring that every line of code serves the dual mandate of <strong className="text-white">uncompromising security</strong> and <strong className="text-white">radical efficiency</strong>.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </section>
        </div>
    );
}
