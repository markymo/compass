import Link from "next/link";
import { BRAND } from "@/config/brand";

export function Footer() {
    return (
        <footer className="border-t border-slate-800 bg-slate-900 py-16 text-slate-400">
            <div className="container mx-auto grid gap-12 px-4 md:grid-cols-4 md:px-6">
                <div className="col-span-1 md:col-span-2">
                    <Link href="/" className="mb-6 flex items-center gap-1">
                        <span className="text-2xl font-bold text-white font-sans tracking-tight flex items-baseline gap-1">
                            {BRAND.name}<span className="inline-block w-3 h-3 bg-amber-500" />
                        </span>
                    </Link>
                    <p className="max-w-sm text-sm leading-relaxed text-slate-300">
                        The Single Source of Truth for company data
                    </p>
                </div>

                <div>
                    <h3 className="mb-6 text-sm font-semibold text-white uppercase tracking-wider">Product</h3>
                    <ul className="space-y-3 text-sm">
                        <li><Link href="/how-it-works" className="hover:text-amber-500 transition-colors">How it Works</Link></li>
                        <li><Link href="/partner" className="hover:text-amber-500 transition-colors">Partner</Link></li>
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

                <div>
                    <h3 className="mb-6 text-sm font-semibold text-white uppercase tracking-wider">Get in Touch</h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-4">Ready to get started or want to arrange a demo?</p>
                    <a
                        href={`mailto:${BRAND.email}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
                    >
                        Contact Us &rarr;
                    </a>
                </div>
            </div>
            <div className="container mx-auto mt-12 border-t border-slate-800 px-4 pt-8 text-center text-xs text-slate-500 md:px-6 md:text-left flex flex-col md:flex-row justify-between items-center">
                <span>&copy; {BRAND.year} {BRAND.name}. All rights reserved.</span>
                <div className="flex gap-6 mt-4 md:mt-0">
                    <Link href="/terms" className="hover:text-slate-300">Terms</Link>
                    <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
                </div>
            </div>
        </footer>
    );
}
