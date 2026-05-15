/**
 * seed-france-mappings.ts
 *
 * Idempotent, additive seed for French SourceFieldMapping rows.
 *
 * Target:
 *   sourceType      = REGISTRATION_AUTHORITY
 *   sourceReference = RA000192  (France — Registre du Commerce / Infogreffe)
 *   mappingScope    = RAW_PAYLOAD
 *   payloadSubtype  = COMPANY_PROFILE
 *
 * API source: API Recherche d'Entreprises (recherche-entreprises.api.gouv.fr)
 * Connector:  FranceRechercheEntreprisesConnector
 *
 * Strategy: upsert-only. No deleteMany, no truncate. Safe to re-run.
 *
 * Field numbers confirmed from live MasterFieldDefinition query (2026-05-15):
 *   F3  Legal name
 *   F6  Registered address line 1
 *   F7  Registered address city
 *   F10 Registered address postcode
 *   F18 Registered number         ← SIREN (not F19 which is "GLEIF entity category")
 *   F21 Entity legal form code    ← nature_juridique raw code (not F19 which is GLEIF-specific)
 *   F26 Entity status
 *   F27 Entity creation date
 *
 * NOT seeded (F9 country):
 *   The French API payload does not expose a country field in siege; country
 *   is always "FR" by definition. RegistryMappingEngine resolves paths from
 *   rawSourcePayload.COMPANY_PROFILE — there is no "FR" value to map from.
 *   Country for French entities should be handled via the RegistryBaselineExtract
 *   (countryCode = "FR") or a SYSTEM_DERIVED mapping — left for a future slice.
 *
 * NOT seeded (F5 previous_names):
 *   The Recherche Entreprises API does not expose previous legal names.
 *   Future: if we add a secondary INPI endpoint, add a COMPANY_NAMES subtype.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RA_ID = 'RA000192';

const MAPPINGS = [
    // ── Core Identity ────────────────────────────────────────────────────────
    {
        sourcePath: 'nom_raison_sociale',
        targetFieldNo: 3,   // Legal name
        transformType: 'DIRECT',
        notes: 'FR Legal Name (official registered name; prefer over nom_complet)'
    },
    {
        sourcePath: 'siren',
        targetFieldNo: 18,  // Registered number
        transformType: 'DIRECT',
        notes: 'FR SIREN — 9-digit national company identifier'
    },
    {
        sourcePath: 'date_creation',
        targetFieldNo: 27,  // Entity creation date
        // date_creation is already "YYYY-MM-DD" ISO format from the API;
        // DATE_TO_ISO is a safe pass-through and makes intent explicit.
        transformType: 'DATE_TO_ISO',
        notes: 'FR Incorporation / creation date (ISO date from API)'
    },
    {
        sourcePath: 'etat_administratif',
        targetFieldNo: 26,  // Entity status
        // Raw value: "A" = actif (active), "C" = cessé (closed).
        // Stored as DIRECT for now; a MAP transform can decode to
        // human-readable values later without changing the seed.
        transformType: 'DIRECT',
        notes: 'FR Entity status code: A=actif, C=cessé. Stored raw; decode later with MAP transform.'
    },
    {
        sourcePath: 'nature_juridique',
        targetFieldNo: 21,  // Entity legal form code (F21, not F19 which is GLEIF-specific)
        // Raw value: 4-digit INSEE code e.g. "5710" = SAS, "5499" = SARL.
        // Stored raw; a MAP transform or lookup table can decode later.
        transformType: 'DIRECT',
        notes: 'FR Legal form — 4-digit INSEE code (e.g. 5710=SAS, 5499=SARL). Stored raw; decode later.'
    },

    // ── Registered Address (siege) ───────────────────────────────────────────
    {
        sourcePath: 'siege.adresse',
        targetFieldNo: 6,   // Registered address line 1
        transformType: 'DIRECT',
        notes: 'FR Registered office — full formatted address string from siege.adresse'
    },
    {
        sourcePath: 'siege.libelle_commune',
        targetFieldNo: 7,   // Registered address city
        transformType: 'DIRECT',
        notes: 'FR Registered city (commune label)'
    },
    {
        sourcePath: 'siege.code_postal',
        targetFieldNo: 10,  // Registered address postcode
        transformType: 'DIRECT',
        notes: 'FR Registered postcode (5-digit code postal)'
    },
] as const;

async function seedFranceMappings() {
    console.log(`[Seed] France RA Mapping Pack — RA000192`);
    console.log(`[Seed] Source: API Recherche d\'Entreprises (recherche-entreprises.api.gouv.fr)`);
    console.log(`[Seed] Strategy: upsert-only (additive/idempotent). No rows will be deleted.\n`);

    // Pre-seed count for delta reporting
    const preSeedCount = await (prisma as any).sourceFieldMapping.count({
        where: { sourceReference: RA_ID }
    });

    let created = 0;
    let updated = 0;
    let alreadyExisting = 0;

    for (const m of MAPPINGS) {
        const whereKey = {
            sourceType_sourceReference_mappingScope_payloadSubtype_sourcePath_targetFieldNo: {
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: RA_ID,
                mappingScope: 'RAW_PAYLOAD',
                payloadSubtype: 'COMPANY_PROFILE',
                sourcePath: m.sourcePath,
                targetFieldNo: m.targetFieldNo
            }
        };

        // Read before upsert so we can report CREATED vs EXISTS vs UPDATED accurately
        const existing = await (prisma as any).sourceFieldMapping.findUnique({ where: whereKey });

        await (prisma as any).sourceFieldMapping.upsert({
            where: whereKey,
            update: {
                isActive: true,
                transformType: m.transformType,
                notes: m.notes
            },
            create: {
                sourceType: 'REGISTRATION_AUTHORITY',
                sourceReference: RA_ID,
                mappingScope: 'RAW_PAYLOAD',
                payloadSubtype: 'COMPANY_PROFILE',
                sourcePath: m.sourcePath,
                targetFieldNo: m.targetFieldNo,
                isActive: true,
                transformType: m.transformType,
                notes: m.notes,
                confidenceDefault: 1.0,
                priority: 10
            }
        });

        if (!existing) {
            created++;
            console.log(`  [CREATED] F${m.targetFieldNo} | ${m.sourcePath}`);
        } else {
            const transformChanged = existing.transformType !== m.transformType;
            const notesChanged = existing.notes !== m.notes;
            if (transformChanged || notesChanged) {
                updated++;
                console.log(`  [UPDATED] F${m.targetFieldNo} | ${m.sourcePath}`);
            } else {
                alreadyExisting++;
                console.log(`  [EXISTS]  F${m.targetFieldNo} | ${m.sourcePath}`);
            }
        }
    }

    // Post-seed count for delta verification
    const postSeedCount = await (prisma as any).sourceFieldMapping.count({
        where: { sourceReference: RA_ID }
    });

    const grandTotal = await (prisma as any).sourceFieldMapping.count();

    console.log(`\n[Seed] Complete.`);
    console.log(`  Created:          ${created} new rows`);
    console.log(`  Updated:          ${updated} rows (metadata only)`);
    console.log(`  Already current:  ${alreadyExisting} rows (no change)`);
    console.log(`  Total processed:  ${MAPPINGS.length}`);
    console.log(`\n[Seed] Row counts for RA000192:`);
    console.log(`  Before: ${preSeedCount}`);
    console.log(`  After:  ${postSeedCount}`);
    console.log(`  Delta:  +${postSeedCount - preSeedCount}`);
    console.log(`\n[Seed] Grand total SourceFieldMapping rows: ${grandTotal}`);
    console.log(`\n[Seed] Verification SQL:`);
    console.log(`  SELECT "sourceType", "sourceReference", COUNT(*) FROM source_field_mappings GROUP BY 1, 2 ORDER BY 1, 2;`);
}

seedFranceMappings()
    .catch(e => {
        console.error('[Seed] Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
