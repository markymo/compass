import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Mail, MapPin } from "lucide-react";

export default function Contact() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 pt-32 pb-16">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="mx-auto max-w-2xl">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl mb-8">
                            Contact Us
                        </h1>
                        <p className="text-xl text-slate-600 mb-12">
                            Interested in learning more about Compass? We'd love to hear from you.
                        </p>

                        <div className="grid gap-8">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 mb-1">Email Us</h3>
                                    <p className="text-slate-600 mb-2">For general inquiries and partnerships:</p>
                                    <a href="mailto:rob@riskbridge.com" className="text-indigo-600 hover:text-indigo-800 font-medium">
                                        rob@riskbridge.com
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                                    <MapPin className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 mb-1">Office</h3>
                                    <p className="text-slate-600">
                                        Riskbridge Limited<br />
                                        London, United Kingdom
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
