import { IRegistryConnector } from "../types/RegistryConnector";
import { RegistryReference } from "@prisma/client";
import { CanonicalRegistryRecord } from "../types/CanonicalRegistryRecord";

/**
 * Connector for France — Registre National des Entreprises
 *
 * Uses the open government API "Recherche d'Entreprises":
 *   https://recherche-entreprises.api.gouv.fr
 *
 * Operated by DINUM. No API key or authentication required.
 * Rate limit: ~7 requests/second per IP.
 *
 * GLEIF authority code: RA000192 (Registre du Commerce et des Sociétés / Infogreffe)
 * Local identifier: SIREN (9 digits, from GLEIF entity.registeredAs)
 *
 * Identifier notes:
 * - SIREN = 9-digit company identifier (used here)
 * - SIRET = 14-digit establishment identifier (SIREN + 5-digit NIC; not needed for LE identity)
 *
 * Payload shape (key fields from siege/company object):
 *   siren, nom_raison_sociale, nom_complet, date_creation,
 *   etat_administratif, nature_juridique, statut_diffusion,
 *   siege.{ code_postal, libelle_commune, numero_voie, type_voie, libelle_voie, adresse }
 */
export class FranceRechercheEntreprisesConnector implements IRegistryConnector {
    readonly connectorKey = "FranceRechercheEntreprisesConnector";

    private static readonly BASE_URL =
        "https://recherche-entreprises.api.gouv.fr";

    /**
     * Handles RA000192 only (France — Infogreffe / RCS).
     * DOM-TOM sub-codes are not mapped by GLEIF separately; RA000192 covers all
     * metropolitan and overseas French registered entities.
     */
    supports(authorityId: string): boolean {
        return authorityId === "RA000192";
    }

    async fetch(reference: RegistryReference): Promise<CanonicalRegistryRecord> {
        // Strip any stray spaces from the GLEIF-supplied SIREN
        const siren = reference.localRegistrationNumber.replace(/\s/g, "");

        if (!siren || siren.length !== 9 || !/^\d{9}$/.test(siren)) {
            throw new Error(
                `[FranceRechercheEntreprisesConnector] Invalid SIREN format: "${siren}". Expected 9 digits.`
            );
        }

        console.log(
            `[FranceRechercheEntreprisesConnector] Fetching data for SIREN ${siren}...`
        );

        const url = `${FranceRechercheEntreprisesConnector.BASE_URL}/search?q=${encodeURIComponent(siren)}&page=1&per_page=1`;

        const res = await fetch(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "CoParity-LE-Enrichment/1.0",
            },
        });

        if (!res.ok) {
            throw new Error(
                `[FranceRechercheEntreprisesConnector] API error: ${res.status} ${res.statusText}`
            );
        }

        const data = await res.json();
        const company = data.results?.[0];

        if (!company) {
            throw new Error(
                `[FranceRechercheEntreprisesConnector] No company found for SIREN ${siren}`
            );
        }

        // Exact SIREN match guard — prevents partial name-search bleed-through
        if (company.siren !== siren) {
            throw new Error(
                `[FranceRechercheEntreprisesConnector] SIREN mismatch: expected ${siren}, got ${company.siren}. ` +
                `Rejecting result to prevent incorrect entity enrichment.`
            );
        }

        // Non-diffusible entity guard (privacy-protected sole traders / individuals)
        if (company.statut_diffusion === "P") {
            const err = new Error(
                `[FranceRechercheEntreprisesConnector] Entity SIREN ${siren} is non-diffusible (statut_diffusion=P). ` +
                `This entity is privacy-protected under French law and cannot be enriched via this API.`
            );
            (err as any).code = "FR_ENTITY_NON_DIFFUSIBLE";
            throw err;
        }

        const record = this.normalize(company);

        // Inject context from reference (caller sets these; normalize() leaves them blank)
        record.registryAuthorityId = reference.registryAuthorityId;
        record.sourceRecordId = siren;
        record.fetchedAt = new Date();

        return record;
    }

    normalize(raw: any): CanonicalRegistryRecord {
        if (!raw) {
            throw new Error(
                "[FranceRechercheEntreprisesConnector] Cannot normalize empty registry record"
            );
        }

        const siege = raw.siege || {};

        // Build address lines from structured fields; fall back to the pre-formatted
        // `siege.adresse` string if component fields are absent.
        const streetLine = [
            siege.numero_voie,
            siege.type_voie,
            siege.libelle_voie,
        ]
            .filter(Boolean)
            .join(" ");

        const addressLines = streetLine
            ? [streetLine]
            : siege.adresse
            ? [siege.adresse]
            : [];

        // Map raw officer/dirigeant records into a consistent shape
        const officers = (raw.dirigeants || []).map((d: any) => ({
            name: [d.prenoms, d.nom].filter(Boolean).join(" "),
            role: d.qualite || null,
            type: d.type_dirigeant || null,
        }));

        return {
            sourceType: "REGISTRATION_AUTHORITY",
            registryKey: "FR_RECHERCHE_ENTREPRISES",
            registryAuthorityId: "", // filled by fetch() caller
            sourceRecordId: "",     // filled by fetch() caller
            fetchedAt: new Date(),

            // Prefer nom_raison_sociale (official registered name) over nom_complet (common name)
            entityName: raw.nom_raison_sociale || raw.nom_complet || "-",

            // "A" = actif (active), "C" = cessé (closed)
            entityStatus: raw.etat_administratif || null,

            incorporationDate: raw.date_creation || null,

            // nature_juridique is a 4-digit code (e.g. 5710 = SAS).
            // Store raw for now; a MAP transform can decode to label later.
            legalForm: raw.nature_juridique || null,

            registeredAddress: {
                lines: addressLines,
                city: siege.libelle_commune || null,
                postalCode: siege.code_postal || null,
                country: "FR",
            },

            identifiers: [
                ...(raw.siren ? [{ type: "SIREN", value: raw.siren }] : []),
            ],

            officers,

            /**
             * Raw payload stored under COMPANY_PROFILE subtype.
             * Matches the subtype convention used by CompaniesHouseConnector.
             * RegistryMappingEngine will resolve paths within this subtype.
             */
            rawSourcePayload: {
                COMPANY_PROFILE: raw,
            },
        };
    }
}
