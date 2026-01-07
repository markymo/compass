import Link from "next/link";
import { Compass } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-slate-800 bg-slate-900 py-16 text-slate-400">
            <div className="container mx-auto grid gap-12 px-4 md:grid-cols-4 md:px-6">
                <div className="col-span-1 md:col-span-2">
                    <Link href="/" className="mb-6 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-slate-900">
                            <Compass className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold text-white font-serif tracking-tight">COMPASS</span>
                    </Link>
                    <p className="max-w-sm text-sm leading-relaxed text-slate-300">
                        The operating system for corporate debt finance onboarding.
                        Standardizing the future of capital markets through a single, verifiable source of truth.
                    </p>
                </div>

                <div>
                    <h3 className="mb-6 text-sm font-semibold text-white uppercase tracking-wider">Product</h3>
                    <ul className="space-y-3 text-sm">
                        <li><Link href="/solutions" className="hover:text-amber-500 transition-colors">Solutions</Link></li>
                        <li><Link href="/how-it-works" className="hover:text-amber-500 transition-colors">How it Works</Link></li>
                    </ul>
                </div>

                <div>
                    <h3 className="mb-6 text-sm font-semibold text-white uppercase tracking-wider">Company</h3>
                    <ul className="space-y-3 text-sm">
                        <li><Link href="/about" className="hover:text-amber-500 transition-colors">About Us</Link></li>
                        <li><Link href="/contact" className="hover:text-amber-500 transition-colors">Contact</Link></li>
                        <li><Link href="/privacy" className="hover:text-amber-500 transition-colors">Privacy Policy</Link></li>
                    </ul>
                </div>
            </div>
            <div className="container mx-auto mt-12 border-t border-slate-800 px-4 pt-8 text-center text-xs text-slate-500 md:px-6 md:text-left flex flex-col md:flex-row justify-between items-center">
                <span>&copy; {new Date().getFullYear()} Compass. All rights reserved.</span>
                <div className="flex gap-6 mt-4 md:mt-0">
                    <Link href="/terms" className="hover:text-slate-300">Terms</Link>
                    <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
                </div>
            </div>
        </footer>
    );
}
