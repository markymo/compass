# SourceFieldMapping Baseline Snapshot — 2026-05-15

## Purpose

This directory contains a point-in-time export of all `source_field_mappings` rows taken
before the **RA Mapping Engine Consolidation** refactor was applied.

It exists for three reasons:

1. **Rollback confidence** — If any seed or migration step accidentally modifies or loses
   rows, the JSON files here are the ground truth to restore from.
2. **Audit trail** — This is a permanent architectural record showing which mappings were
   active before the consolidation. Future engineers can diff this against later snapshots.
3. **Team confidence** — No destructive operations were performed. All changes in this
   refactor slice were additive (upsert-only). The row counts below can be verified at any
   time against the live database.

## Baseline State (taken 2026-05-15 before any code changes)

| sourceType              | sourceReference | Row Count |
|-------------------------|----------------|-----------|
| GLEIF                   | (global/null)  | 14        |
| REGISTRATION_AUTHORITY  | RA000585 (EW)  | 8         |
| REGISTRATION_AUTHORITY  | RA000586 (Scot)| 8         |
| REGISTRATION_AUTHORITY  | RA000587 (NI)  | 8         |
| REGISTRATION_AUTHORITY  | (global/null)  | 5         |
| **TOTAL**               |                | **43**    |

## Files

- `counts.json` — Row counts grouped by sourceType and sourceReference.
- `ra-mappings.json` — Full export of all REGISTRATION_AUTHORITY rows.
- `gleif-mappings.json` — Full export of all GLEIF rows.

## Verification Query

Run this against the production database at any time to confirm no rows were lost:

```sql
SELECT "sourceType", "sourceReference", COUNT(*) AS count
FROM source_field_mappings
GROUP BY "sourceType", "sourceReference"
ORDER BY "sourceType", "sourceReference";

SELECT COUNT(*) AS total_mappings FROM source_field_mappings;
```

Expected total after the Field 5 seed (the only additive change): **46 rows**
(+3 new rows: previous_names → Field 5 for RA000585, RA000586, RA000587)

## Refactor Scope

The RA Mapping Engine Consolidation made the following changes:
- `CanonicalRegistryMapper` deprecated (file preserved, logging added)
- `LegalEntityEnrichmentService.refreshRegistryClaims` — uses `RegistryMappingEngine` only
- `acceptProposal` — RA branch uses `RegistryMappingEngine` via stored `EnrichmentRun`
- UK seed extended with Field 5 (`previous_names`) mapping for all three UK RA IDs

GLEIF normalizer was **not touched** in this slice.
