-- ============================================================
-- DEFINITIVE RECOVERY: Global template + deleted copies merged
-- Target:  431c9e3a-eb07-4652-9c37-8e8ecf3b4f56  (live instance)
-- Primary: e5f593fd-5d7f-459f-bd70-073467fb7339  (global template)
-- Supplementary: all deleted copies (for gaps not in template)
-- Date: 17 May 2026
-- ============================================================
--
-- NOTES ON QUESTIONABLE MAPPINGS IN THE GLOBAL TEMPLATE:
--   Order 14: "NAME OF REGULATOR" → field 25 "Entity legal form
--             transliterated name" — looks like a mis-mapping.
--             Will be applied as-is; override manually if needed.
--   Order 35: "DIRECT SHAREHOLDERS" → field 60 "Certificate of
--             incorporation" — likely a placeholder. Review manually.
--
-- ============================================================
-- STEP 1: PREVIEW (always run this before the UPDATE)
-- Shows exactly what will change, row by row.
-- ============================================================

WITH
template AS (
    SELECT
        qq."order",
        qq."masterFieldNo",
        qq."masterQuestionGroupId",
        qq."customFieldDefinitionId",
        qq."compactText"
    FROM "Question" qq
    WHERE qq."questionnaireId" = 'e5f593fd-5d7f-459f-bd70-073467fb7339'
),
deleted_consensus AS (
    -- Best mapping from deleted copies, for positions template leaves unmapped
    SELECT DISTINCT ON (qq."order")
        qq."order",
        qq."masterFieldNo",
        qq."masterQuestionGroupId",
        qq."customFieldDefinitionId"
    FROM "Question" qq
    JOIN "Questionnaire" qr ON qr.id = qq."questionnaireId"
    WHERE qr."isDeleted" = true
      AND qr.name = 'FMSB Standard - UK V2'
      AND (
          qq."masterFieldNo"           IS NOT NULL
       OR qq."masterQuestionGroupId"   IS NOT NULL
       OR qq."customFieldDefinitionId" IS NOT NULL
      )
    GROUP BY qq."order", qq."masterFieldNo", qq."masterQuestionGroupId", qq."customFieldDefinitionId"
    ORDER BY qq."order", COUNT(*) DESC
),
merged_source AS (
    -- Global template wins; deleted-copy consensus fills gaps
    SELECT
        t."order",
        COALESCE(t."masterFieldNo",         dc."masterFieldNo")         AS merged_fieldNo,
        COALESCE(t."masterQuestionGroupId", dc."masterQuestionGroupId") AS merged_groupId,
        COALESCE(t."customFieldDefinitionId", dc."customFieldDefinitionId") AS merged_customId,
        t."compactText"                                                 AS template_compactText
    FROM template t
    LEFT JOIN deleted_consensus dc ON dc."order" = t."order"
)
SELECT
    tgt."order",
    LEFT(tgt.text, 70)              AS question_text,
    -- Current target state
    tgt."masterFieldNo"             AS current_fieldNo,
    tgt."masterQuestionGroupId"     AS current_groupId,
    -- What will be applied
    ms.merged_fieldNo               AS will_set_fieldNo,
    mf."fieldName"                  AS will_set_field_name,
    ms.merged_groupId               AS will_set_groupId,
    ms.template_compactText         AS will_set_compactText,
    CASE
        WHEN tgt."masterFieldNo"          IS NOT NULL
          OR tgt."masterQuestionGroupId"  IS NOT NULL
          OR tgt."customFieldDefinitionId" IS NOT NULL
            THEN 'SKIP (already mapped)'
        WHEN ms.merged_fieldNo IS NULL
         AND ms.merged_groupId IS NULL
         AND ms.merged_customId IS NULL
            THEN 'NO DATA — map manually'
        ELSE 'WILL RESTORE'
    END                             AS action,
    CASE
        WHEN ms.merged_fieldNo IS NOT NULL
         AND (SELECT "masterFieldNo" FROM "Question"
              WHERE "questionnaireId" = 'e5f593fd-5d7f-459f-bd70-073467fb7339'
                AND "order" = tgt."order") IS NULL
            THEN 'from deleted copies'
        ELSE 'from global template'
    END                             AS mapping_source
FROM "Question" tgt
JOIN merged_source ms ON ms."order" = tgt."order"
LEFT JOIN master_field_definitions mf ON mf."fieldNo" = ms.merged_fieldNo
WHERE tgt."questionnaireId" = '431c9e3a-eb07-4652-9c37-8e8ecf3b4f56'
ORDER BY tgt."order";


-- ============================================================
-- STEP 2: RECOVERY UPDATE
-- Only run after reviewing Step 1 output.
-- Wrapped in BEGIN/COMMIT — ROLLBACK if anything looks wrong.
-- ============================================================

BEGIN;

WITH
template AS (
    SELECT
        qq."order",
        qq."masterFieldNo",
        qq."masterQuestionGroupId",
        qq."customFieldDefinitionId",
        qq."compactText"
    FROM "Question" qq
    WHERE qq."questionnaireId" = 'e5f593fd-5d7f-459f-bd70-073467fb7339'
),
deleted_consensus AS (
    SELECT DISTINCT ON (qq."order")
        qq."order",
        qq."masterFieldNo",
        qq."masterQuestionGroupId",
        qq."customFieldDefinitionId"
    FROM "Question" qq
    JOIN "Questionnaire" qr ON qr.id = qq."questionnaireId"
    WHERE qr."isDeleted" = true
      AND qr.name = 'FMSB Standard - UK V2'
      AND (
          qq."masterFieldNo"           IS NOT NULL
       OR qq."masterQuestionGroupId"   IS NOT NULL
       OR qq."customFieldDefinitionId" IS NOT NULL
      )
    GROUP BY qq."order", qq."masterFieldNo", qq."masterQuestionGroupId", qq."customFieldDefinitionId"
    ORDER BY qq."order", COUNT(*) DESC
),
merged_source AS (
    SELECT
        t."order",
        COALESCE(t."masterFieldNo",           dc."masterFieldNo")           AS merged_fieldNo,
        COALESCE(t."masterQuestionGroupId",   dc."masterQuestionGroupId")   AS merged_groupId,
        COALESCE(t."customFieldDefinitionId", dc."customFieldDefinitionId") AS merged_customId,
        t."compactText"                                                      AS template_compactText
    FROM template t
    LEFT JOIN deleted_consensus dc ON dc."order" = t."order"
)
UPDATE "Question" AS tgt
SET
    "masterFieldNo"           = ms.merged_fieldNo,
    "masterQuestionGroupId"   = ms.merged_groupId,
    "customFieldDefinitionId" = ms.merged_customId,
    -- Always backfill compactText if target is missing one
    "compactText"             = COALESCE(tgt."compactText", ms.template_compactText)
FROM merged_source ms
WHERE tgt."questionnaireId" = '431c9e3a-eb07-4652-9c37-8e8ecf3b4f56'
  AND tgt."order"           = ms."order"
  -- Never overwrite an existing mapping
  AND tgt."masterFieldNo"           IS NULL
  AND tgt."masterQuestionGroupId"   IS NULL
  AND tgt."customFieldDefinitionId" IS NULL
  -- Only apply where there is actually something to set
  AND (
      ms.merged_fieldNo   IS NOT NULL
   OR ms.merged_groupId   IS NOT NULL
   OR ms.merged_customId  IS NOT NULL
  )
  -- Exclude questionable mappings — set these manually in the UI
  AND tgt."order" NOT IN (14, 35);

-- Check the rowcount before committing.
-- Expected: 13 rows (orders 1,2,3,6,8,9,10,12,13,14,30,35,37 from template
--           + orders 5,7 from deleted copies = up to 15 total)
-- Order 4 will be SKIPPED (already has REGISTERED_ADDRESS group).

COMMIT;
-- ROLLBACK;


-- ============================================================
-- STEP 3: VERIFY — final state after recovery
-- ============================================================

SELECT
    qq."order",
    LEFT(qq.text, 70)               AS question_text,
    qq."masterFieldNo",
    mf."fieldName"                  AS field_name,
    qq."masterQuestionGroupId"      AS group_key,
    qq."compactText",
    CASE
        WHEN qq."masterFieldNo"           IS NOT NULL THEN 'FIELD'
        WHEN qq."masterQuestionGroupId"   IS NOT NULL THEN 'GROUP'
        WHEN qq."customFieldDefinitionId" IS NOT NULL THEN 'CUSTOM'
        ELSE 'STILL UNMAPPED — do manually'
    END                             AS status
FROM "Question" qq
LEFT JOIN master_field_definitions mf ON mf."fieldNo" = qq."masterFieldNo"
WHERE qq."questionnaireId" = '431c9e3a-eb07-4652-9c37-8e8ecf3b4f56'
ORDER BY qq."order";
