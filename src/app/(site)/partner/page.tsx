import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { PartnerClient } from "./PartnerClient";

export const metadata: Metadata = {
    title: `Partner Collaboration | ${BRAND.name}`,
    description: `Partner with ${BRAND.name} to streamline client onboarding, improve data accuracy, and free team resources.`,
    openGraph: {
        title: `Partner Collaboration | ${BRAND.name}`,
        description: `Partner with ${BRAND.name} to streamline client onboarding, improve data accuracy, and free team resources.`,
        url: `${BRAND.website}/partner`,
        siteName: BRAND.name,
        locale: "en_GB",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: `Partner Collaboration | ${BRAND.name}`,
        description: `Partner with ${BRAND.name} to streamline client onboarding, improve data accuracy, and free team resources.`,
    },
};

export default function PartnerPage() {
    return <PartnerClient />;
}
