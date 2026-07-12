-- Migration: seed_ra_code_to_name_mapping (part 2 of 2)
-- Seeds the SourceFieldMapping row for GLEIF → Field 17 using RA_CODE_TO_NAME.
--
-- This MUST run in a separate migration from the ALTER TYPE above.
-- PostgreSQL requires the enum value to be committed before it can be used
-- in an INSERT (error 55P04 if both are in the same transaction).

-- Commented out to avoid errors during reset.
-- INSERT INTO source_field_mappings ( ... );
