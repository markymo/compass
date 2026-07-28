import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { HowItWorksClient } from "./HowItWorksClient";

export const metadata: Metadata = {
    title: `How It Works | ${BRAND.name}`,
    description: `Discover how ${BRAND.name} eliminates duplicative compliance forms and automatically builds your single source of truth company knowledge base.`,
    openGraph: {
        title: `How It Works | ${BRAND.name}`,
        description: `Discover how ${BRAND.name} eliminates duplicative compliance forms and automatically builds your single source of truth company knowledge base.`,
        url: `${BRAND.website}/how-it-works`,
        siteName: BRAND.name,
        locale: "en_GB",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: `How It Works | ${BRAND.name}`,
        description: `Discover how ${BRAND.name} eliminates duplicative compliance forms and automatically builds your single source of truth company knowledge base.`,
    },
};

export default function HowItWorksPage() {
    return <HowItWorksClient />;
}
