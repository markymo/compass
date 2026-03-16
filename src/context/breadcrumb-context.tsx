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
    isWide?: boolean;
    setIsWide: (wide: boolean) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [extraBreadcrumbs, setExtraBreadcrumbsState] = useState<BreadcrumbItemData[]>([]);
    const [pageTitle, setPageTitle] = useState<string | undefined>(undefined);
    const [pageTypeLabel, setPageTypeLabel] = useState<string | undefined>(undefined);
    const [secondaryNav, setSecondaryNav] = useState<React.ReactNode | undefined>(undefined);
    const [isWide, setIsWide] = useState(false);

    const setExtraBreadcrumbs = React.useCallback((items: BreadcrumbItemData[]) => {
        setExtraBreadcrumbsState(items);
    }, []);

    const clearExtraBreadcrumbs = React.useCallback(() => {
        setExtraBreadcrumbsState([]);
    }, []);

    const setPageTitleStable = React.useCallback((title: string | undefined) => {
        setPageTitle(title);
    }, []);

    const setPageTypeLabelStable = React.useCallback((label: string | undefined) => {
        setPageTypeLabel(label);
    }, []);

    const setSecondaryNavStable = React.useCallback((nav: React.ReactNode | undefined) => {
        setSecondaryNav(nav);
    }, []);

    const setIsWideStable = React.useCallback((wide: boolean) => {
        setIsWide(wide);
    }, []);

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

    const contextValue = useMemo(() => ({
        extraBreadcrumbs, 
        setExtraBreadcrumbs, 
        clearExtraBreadcrumbs, 
        currentBreadcrumbs,
        pageTitle,
        setPageTitle: setPageTitleStable,
        pageTypeLabel,
        setPageTypeLabel: setPageTypeLabelStable,
        secondaryNav,
        setSecondaryNav: setSecondaryNavStable,
        isWide,
        setIsWide: setIsWideStable
    }), [
        extraBreadcrumbs, 
        setExtraBreadcrumbs, 
        clearExtraBreadcrumbs, 
        currentBreadcrumbs,
        pageTitle,
        setPageTitleStable,
        pageTypeLabel,
        setPageTypeLabelStable,
        secondaryNav,
        setSecondaryNavStable,
        isWide,
        setIsWideStable
    ]);

    return (
        <BreadcrumbContext.Provider value={contextValue}>
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
    isWide?: boolean;
}

export function SetPageBreadcrumbs({ items, title, typeLabel, secondaryNav, isWide }: SetPageBreadcrumbsProps) {
    const { setExtraBreadcrumbs, clearExtraBreadcrumbs, setPageTitle, setPageTypeLabel, setSecondaryNav, setIsWide } = useBreadcrumbs();

    useEffect(() => {
        setExtraBreadcrumbs(items);
        setPageTitle(title);
        setPageTypeLabel(typeLabel);
        setSecondaryNav(secondaryNav);
        if (isWide !== undefined) setIsWide(isWide);
        
        return () => {
            // Only clear breadcrumbs, let the next page's SetPageBreadcrumbs take over title/nav
            // to avoid race conditions during page transitions.
            clearExtraBreadcrumbs();
        };
    }, [JSON.stringify(items), title, typeLabel, secondaryNav, isWide, setExtraBreadcrumbs, clearExtraBreadcrumbs, setPageTitle, setPageTypeLabel, setSecondaryNav, setIsWide]);

    return null;
}
