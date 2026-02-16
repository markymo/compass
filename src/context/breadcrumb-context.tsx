"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { GuideBreadcrumbItem } from "@/components/layout/GuideHeader";

interface BreadcrumbContextType {
    extraBreadcrumbs: GuideBreadcrumbItem[];
    setExtraBreadcrumbs: (items: GuideBreadcrumbItem[]) => void;
    clearExtraBreadcrumbs: () => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
    const [extraBreadcrumbs, setExtraBreadcrumbsState] = useState<GuideBreadcrumbItem[]>([]);

    const setExtraBreadcrumbs = (items: GuideBreadcrumbItem[]) => {
        setExtraBreadcrumbsState(items);
    };

    const clearExtraBreadcrumbs = () => {
        setExtraBreadcrumbsState([]);
    };

    return (
        <BreadcrumbContext.Provider value={{ extraBreadcrumbs, setExtraBreadcrumbs, clearExtraBreadcrumbs }}>
            {children}
        </BreadcrumbContext.Provider>
    );
}

export function useBreadcrumbs() {
    const context = useContext(BreadcrumbContext);
    if (!context) {
        throw new Error("useBreadcrumbs must be used within a BreadcrumbProvider");
    }
    return context;
}

interface SetPageBreadcrumbsProps {
    items: GuideBreadcrumbItem[];
}

export function SetPageBreadcrumbs({ items }: SetPageBreadcrumbsProps) {
    const { setExtraBreadcrumbs, clearExtraBreadcrumbs } = useBreadcrumbs();

    useEffect(() => {
        setExtraBreadcrumbs(items);
        return () => {
            clearExtraBreadcrumbs();
        };
    }, [JSON.stringify(items), setExtraBreadcrumbs, clearExtraBreadcrumbs]);

    return null;
}
