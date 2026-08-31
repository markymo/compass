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

const TRUSTED_REGISTRY_HOSTS = new Set([
    "search.gleif.org",
    "find-and-update.company-information.service.gov.uk",
    "annuaire-entreprises.data.gouv.fr",
]);

/**
 * Validates whether a given URL is a safe HTTPS link from an allowed registry domain.
 */
export function isSafeRegistryUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://")) return false;

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "https:") return false;
        return TRUSTED_REGISTRY_HOSTS.has(parsed.hostname.toLowerCase());
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

/**
 * Generic extraction of registry entity identifier (e.g. UK company number, GLEIF LEI, SIREN)
 * from persisted EvidenceStore payload or claim metadata.
 */
export function extractRegistryEntityIdentifier(
    evidence?: { payload?: any; provider?: string } | null,
    claim?: { sourceType?: string | null; sourceReference?: string | null; valueText?: string | null; fieldNo?: number } | null
): string | null {
    if (!evidence && !claim) return null;

    const payload = evidence?.payload;
    if (payload && typeof payload === "object") {
        // 1. UK Companies House / National Registry structures
        if (typeof payload.company_number === "string" && payload.company_number.trim()) {
            return payload.company_number.trim();
        }
        if (typeof payload.COMPANY_PROFILE?.company_number === "string" && payload.COMPANY_PROFILE.company_number.trim()) {
            return payload.COMPANY_PROFILE.company_number.trim();
        }
        if (typeof payload.localRegistrationNumber === "string" && payload.localRegistrationNumber.trim()) {
            return payload.localRegistrationNumber.trim();
        }
        if (typeof payload.registrationNumber === "string" && payload.registrationNumber.trim()) {
            return payload.registrationNumber.trim();
        }
        if (typeof payload.companyNumber === "string" && payload.companyNumber.trim()) {
            return payload.companyNumber.trim();
        }
        if (typeof payload.externalId === "string" && payload.externalId.trim()) {
            return payload.externalId.trim();
        }

        // 2. GLEIF structures
        if (typeof payload.attributes?.lei === "string" && payload.attributes.lei.trim()) {
            return payload.attributes.lei.trim();
        }
        if (typeof payload.lei === "string" && payload.lei.trim()) {
            return payload.lei.trim();
        }
        if (Array.isArray(payload.data) && payload.data.length > 0) {
            const first = payload.data[0];
            if (typeof first?.attributes?.lei === "string" && first.attributes.lei.trim()) {
                return first.attributes.lei.trim();
            }
            if (typeof first?.id === "string" && /^[0-9A-Z]{20}$/i.test(first.id.trim())) {
                return first.id.trim();
            }
        }
        if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
            if (typeof payload.data.attributes?.lei === "string" && payload.data.attributes.lei.trim()) {
                return payload.data.attributes.lei.trim();
            }
            if (typeof payload.data.id === "string" && /^[0-9A-Z]{20}$/i.test(payload.data.id.trim())) {
                return payload.data.id.trim();
            }
        }

        // 3. France / SIREN structures
        if (typeof payload.siren === "string" && payload.siren.trim()) {
            return payload.siren.trim();
        }
        if (typeof payload.siege?.siren === "string" && payload.siege.siren.trim()) {
            return payload.siege.siren.trim();
        }
    }

    // 4. Fallback from claim itself if claim is an identifier field (e.g. Field 1 LEI, Field 2 / 1002 Company Number)
    if (claim && typeof claim.valueText === "string" && claim.valueText.trim()) {
        const val = claim.valueText.trim();
        const st = (claim.sourceType || "").toUpperCase();
        if (st === "GLEIF" && /^[0-9A-Z]{20}$/i.test(val)) {
            return val;
        }
        if ((st === "REGISTRATION_AUTHORITY" || st === "COMPANIES_HOUSE") && /^[0-9A-Z]{6,10}$/i.test(val)) {
            return val;
        }
    }

    return null;
}

