"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { STATIC_BREADCRUMBS, HOME_BREADCRUMB } from '@/lib/breadcrumb-config';

export interface BreadcrumbItemData {
    label: string;
    href?: string;
    icon?: any;
    iconName?: string;
}

interface BreadcrumbContextType {
    extraBreadcrumbs: BreadcrumbItemData[];
    setExtraBreadcrumbs: (items: BreadcrumbItemData[]) => void;
    clearExtraBreadcrumbs: () => void;
    currentBreadcrumbs: BreadcrumbItemData[];
    pageTitle?: string;
    setPageTitle: (title: string | undefined) => void;
    pageTypeLabel?: string;
    setPageTypeLabel: (label: string | undefined) => void;
    secondaryNav?: React.ReactNode;
    setSecondaryNav: (nav: React.ReactNode | undefined) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [extraBreadcrumbs, setExtraBreadcrumbsState] = useState<BreadcrumbItemData[]>([]);
    const [pageTitle, setPageTitle] = useState<string | undefined>(undefined);
    const [pageTypeLabel, setPageTypeLabel] = useState<string | undefined>(undefined);
    const [secondaryNav, setSecondaryNav] = useState<React.ReactNode | undefined>(undefined);

    const setExtraBreadcrumbs = (items: BreadcrumbItemData[]) => {
        setExtraBreadcrumbsState(items);
    };

    const clearExtraBreadcrumbs = () => {
        setExtraBreadcrumbsState([]);
    };

    const currentBreadcrumbs = useMemo(() => {
        // Start with Home
        const trail: BreadcrumbItemData[] = [HOME_BREADCRUMB];

        // Check if there's a static config for the current path
        const staticConfig = STATIC_BREADCRUMBS[pathname];

        if (extraBreadcrumbs.length > 0) {
            // If extra breadcrumbs are provided (likely by entity layouts), use them
            return [...trail, ...extraBreadcrumbs];
        }

        if (staticConfig && pathname !== "/app") {
            trail.push(staticConfig);
        }

        return trail;
    }, [pathname, extraBreadcrumbs]);

    return (
        <BreadcrumbContext.Provider value={{ 
            extraBreadcrumbs, 
            setExtraBreadcrumbs, 
            clearExtraBreadcrumbs, 
            currentBreadcrumbs,
            pageTitle,
            setPageTitle,
            pageTypeLabel,
            setPageTypeLabel,
            secondaryNav,
            setSecondaryNav
        }}>
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
    items: BreadcrumbItemData[];
    title?: string;
    typeLabel?: string;
    secondaryNav?: React.ReactNode;
}

export function SetPageBreadcrumbs({ items, title, typeLabel, secondaryNav }: SetPageBreadcrumbsProps) {
    const { setExtraBreadcrumbs, clearExtraBreadcrumbs, setPageTitle, setPageTypeLabel, setSecondaryNav } = useBreadcrumbs();

    useEffect(() => {
        setExtraBreadcrumbs(items);
        if (title) setPageTitle(title);
        if (typeLabel) setPageTypeLabel(typeLabel);
        if (secondaryNav) setSecondaryNav(secondaryNav);
        
        return () => {
            clearExtraBreadcrumbs();
            setPageTitle(undefined);
            setPageTypeLabel(undefined);
            setSecondaryNav(undefined);
        };
    }, [JSON.stringify(items), title, typeLabel, secondaryNav, setExtraBreadcrumbs, clearExtraBreadcrumbs, setPageTitle, setPageTypeLabel, setSecondaryNav]);

    return null;
}
