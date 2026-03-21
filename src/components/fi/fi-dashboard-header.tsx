"use client";

import { useBreadcrumbs } from "@/context/breadcrumb-context";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { Home, Landmark } from "lucide-react";

export function FIDashboardHeader({ org }: { org: any }) {
    const { secondaryNav, pageTitle, pageTypeLabel } = useBreadcrumbs();
    
    return (
        <StandardPageHeader
            title={pageTitle || org.name}
            typeLabel={pageTypeLabel || "Financial Institution"}
            breadcrumbs={[
                { label: "Home", href: "/app", icon: Home },
                { label: org.name, icon: Landmark }
            ]}
            secondaryNav={secondaryNav}
        />
    );
}
