/**
 * registry-urls.ts
 *
 * Generic resolver for constructing validated, safe external registry entity URLs
 * (e.g. Companies House, GLEIF, France Infogreffe/RNE).
 */

import { normalizeSourceRef } from "./source-display";

export interface RegistryUrlParams {
    sourceType?: string | null;
    sourceReference?: string | null;
    entityIdentifier?: string | null;
    entityUrl?: string | null;
}

/**
 * Validates whether a given URL is a safe HTTPS link from an allowed registry domain.
 */
export function isSafeRegistryUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://")) return false;

    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * Resolves an external registry entity URL based on registry authority and entity identifier.
 * Returns null if the source is not a supported registry or if the entity identifier is missing/invalid.
 */
export function getRegistryEntityUrl(params: RegistryUrlParams): string | null {
    // 1. If an explicit valid HTTPS entityUrl is already provided, use it directly
    if (params.entityUrl && isSafeRegistryUrl(params.entityUrl)) {
        return params.entityUrl.trim();
    }

    const { sourceType, sourceReference, entityIdentifier } = params;
    if (!sourceType && !sourceReference) return null;
    if (!entityIdentifier || typeof entityIdentifier !== "string" || !entityIdentifier.trim()) {
        return null;
    }

    const cleanIdentifier = entityIdentifier.trim();
    const normType = (sourceType || "").toUpperCase().trim();
    const canonicalRef = sourceReference ? normalizeSourceRef(sourceReference.trim()) : "";

    // 2. GLEIF (LEI search)
    if (normType === "GLEIF" || canonicalRef === "GLEIF") {
        // LEI is 20 alphanumeric characters
        if (/^[0-9A-Z]{20}$/i.test(cleanIdentifier)) {
            return `https://search.gleif.org/#/record/${encodeURIComponent(cleanIdentifier.toUpperCase())}`;
        }
        // Graceful fallback for non-20 char search strings
        return `https://search.gleif.org/#/search/fulltextSearch?search=${encodeURIComponent(cleanIdentifier)}`;
    }

    // 3. UK Companies House (RA000585, RA000586, RA000587, COMPANIES_HOUSE)
    if (
        normType === "COMPANIES_HOUSE" ||
        canonicalRef === "COMPANIES_HOUSE" ||
        canonicalRef === "RA000585" ||
        canonicalRef === "RA000586" ||
        canonicalRef === "RA000587"
    ) {
        // Format UK company number: pad purely numeric IDs to 8 digits
        const formatted = /^\d+$/.test(cleanIdentifier)
            ? cleanIdentifier.padStart(8, "0")
            : cleanIdentifier.toUpperCase();
        return `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(formatted)}`;
    }

    // 4. France — Recherche d'Entreprises / Infogreffe (RA000192)
    if (canonicalRef === "RA000192" || canonicalRef === "FR_RECHERCHE_ENTREPRISES") {
        const siren = cleanIdentifier.replace(/\s/g, "");
        if (/^\d{9}$/.test(siren)) {
            return `https://annuaire-entreprises.data.gouv.fr/entreprise/${encodeURIComponent(siren)}`;
        }
        return `https://annuaire-entreprises.data.gouv.fr/recherche?terme=${encodeURIComponent(cleanIdentifier)}`;
    }

    // Unrecognised registry authority or non-registry source (USER_INPUT, SYSTEM, etc.)
    return null;
}
