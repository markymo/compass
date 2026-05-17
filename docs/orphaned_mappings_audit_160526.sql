-- ============================================================
-- ORPHANED MAPPING AUDIT — Compass Production (Neon)
-- Date: 16 May 2026
-- Run each section independently in the Neon SQL editor.
-- READ-ONLY: no mutations. Safe to run at any time.
-- ============================================================


-- ============================================================
-- SECTION 1: FMSB duplicates — which copies had mapping work?
-- This tells you whether any deleted copy had MORE mapping work
-- done on it than the current live record (431c9e3a).
-- ============================================================

SELECT
    q.id,
    q.name,
    q."isDeleted",
    q."isGlobal",
    q."isTemplate",
    q.status,
    q."createdAt",
    q."updatedAt",
    COUNT(qq.id)                                                        AS total_questions,
    COUNT(CASE WHEN qq."masterFieldNo"         IS NOT NULL THEN 1 END) AS mapped_by_field,
    COUNT(CASE WHEN qq."masterQuestionGroupId" IS NOT NULL THEN 1 END) AS mapped_by_group,
    COUNT(CASE WHEN qq."customFieldDefinitionId" IS NOT NULL THEN 1 END) AS mapped_custom,
    COUNT(CASE WHEN qq."masterFieldNo" IS NOT NULL
               OR   qq."masterQuestionGroupId" IS NOT NULL
               OR   qq."customFieldDefinitionId" IS NOT NULL THEN 1 END) AS total_mapped
FROM "Questionnaire" q
LEFT JOIN "Question" qq ON qq."questionnaireId" = q.id
WHERE q.name = 'FMSB Standard - UK V2'
GROUP BY q.id, q.name, q."isDeleted", q."isGlobal", q."isTemplate", q.status, q."createdAt", q."updatedAt"
ORDER BY q."createdAt";


-- ============================================================
-- SECTION 2: ALL Question rows on soft-deleted questionnaires
-- that have mapping data — these represent "lost work".
-- ============================================================

SELECT
    qr.id                   AS questionnaire_id,
    qr.name                 AS questionnaire_name,
    qr."createdAt"          AS questionnaire_created,
    qr."updatedAt"          AS questionnaire_last_updated,
    qq.id                   AS question_id,
    qq."order",
    LEFT(qq.text, 80)       AS question_text,
    qq."masterFieldNo",
    qq."masterQuestionGroupId",
    qq."customFieldDefinitionId",
    mf."fieldName"          AS mapped_field_name
FROM "Question" qq
JOIN "Questionnaire" qr ON qr.id = qq."questionnaireId"
LEFT JOIN master_field_definitions mf ON mf."fieldNo" = qq."masterFieldNo"
WHERE qr."isDeleted" = true
  AND (
      qq."masterFieldNo"            IS NOT NULL
   OR qq."masterQuestionGroupId"   IS NOT NULL
   OR qq."customFieldDefinitionId" IS NOT NULL
  )
ORDER BY qr."createdAt" DESC, qq."order";


-- ============================================================
-- SECTION 3: Questionnaire instances with NO engagement link
-- (isTemplate=false, fiEngagementId=null, not deleted, not global)
-- These are "free-floating" instances — shouldn't exist.
-- ============================================================

SELECT
    id,
    name,
    status,
    "isTemplate",
    "isGlobal",
    "fiOrgId",
    "fiEngagementId",
    "createdAt",
    "updatedAt"
FROM "Questionnaire"
WHERE "isDeleted"      = false
  AND "isTemplate"     = false
  AND "isGlobal"       = false
  AND "fiEngagementId" IS NULL
ORDER BY "createdAt" DESC;


-- ============================================================
-- SECTION 4: Question rows pointing to a masterFieldNo that
-- no longer exists in master_field_definitions.
-- These break prefill / momentum logic silently.
-- ============================================================

SELECT
    qr.id           AS questionnaire_id,
    qr.name         AS questionnaire_name,
    qr."isDeleted"  AS questionnaire_deleted,
    qq.id           AS question_id,
    qq."order",
    LEFT(qq.text, 80) AS question_text,
    qq."masterFieldNo"
FROM "Question" qq
JOIN "Questionnaire" qr ON qr.id = qq."questionnaireId"
WHERE qq."masterFieldNo" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM master_field_definitions mf
      WHERE mf."fieldNo" = qq."masterFieldNo"
  )
ORDER BY qr.name, qq."order";


-- ============================================================
-- SECTION 5: source_field_mappings pointing to an INACTIVE
-- MasterFieldDefinition (the mapping is "live" but the target
-- field is switched off — will be silently ignored at runtime).
-- ============================================================

SELECT
    sm.id               AS mapping_id,
    sm."sourceType",
    sm."sourceReference",
    sm."sourcePath",
    sm."targetFieldNo",
    sm."isActive"       AS mapping_active,
    mf."fieldName",
    mf."isActive"       AS field_active,
    mf."fieldNo"
FROM source_field_mappings sm
JOIN master_field_definitions mf ON mf."fieldNo" = sm."targetFieldNo"
WHERE mf."isActive" = false
  AND sm."isActive" = true
ORDER BY sm."sourceType", sm."targetFieldNo";


-- ============================================================
-- SECTION 6: source_field_mappings with NO matching
-- MasterFieldDefinition at all (targetFieldNo dangling).
-- ============================================================

SELECT
    sm.id,
    sm."sourceType",
    sm."sourceReference",
    sm."sourcePath",
    sm."targetFieldNo",
    sm."isActive",
    sm."createdAt"
FROM source_field_mappings sm
WHERE NOT EXISTS (
    SELECT 1
    FROM master_field_definitions mf
    WHERE mf."fieldNo" = sm."targetFieldNo"
)
ORDER BY sm."sourceType", sm."targetFieldNo";


-- ============================================================
-- SECTION 7: SUMMARY — count of orphans per category
-- Run this first for a quick overview.
-- ============================================================

SELECT
    'Q1: FMSB duplicate questionnaires'                          AS check_name,
    COUNT(*)                                                     AS count
FROM "Questionnaire"
WHERE name = 'FMSB Standard - UK V2'

UNION ALL

SELECT
    'Q2: Mapped questions on soft-deleted questionnaires',
    COUNT(*)
FROM "Question" qq
JOIN "Questionnaire" qr ON qr.id = qq."questionnaireId"
WHERE qr."isDeleted" = true
  AND (qq."masterFieldNo" IS NOT NULL OR qq."masterQuestionGroupId" IS NOT NULL OR qq."customFieldDefinitionId" IS NOT NULL)

UNION ALL

SELECT
    'Q3: Free-floating instances (no engagement, not template)',
    COUNT(*)
FROM "Questionnaire"
WHERE "isDeleted" = false AND "isTemplate" = false AND "isGlobal" = false AND "fiEngagementId" IS NULL

UNION ALL

SELECT
    'Q4: Questions with dangling masterFieldNo (field deleted)',
    COUNT(*)
FROM "Question" qq
WHERE qq."masterFieldNo" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_field_definitions mf WHERE mf."fieldNo" = qq."masterFieldNo")

UNION ALL

SELECT
    'Q5: Source mappings targeting an inactive master field',
    COUNT(*)
FROM source_field_mappings sm
JOIN master_field_definitions mf ON mf."fieldNo" = sm."targetFieldNo"
WHERE mf."isActive" = false AND sm."isActive" = true

UNION ALL

SELECT
    'Q6: Source mappings with no matching master field at all',
    COUNT(*)
FROM source_field_mappings sm
WHERE NOT EXISTS (SELECT 1 FROM master_field_definitions mf WHERE mf."fieldNo" = sm."targetFieldNo");
