-- Update MasterFieldDefinitions
UPDATE master_field_definitions 
SET "appDataType" = 'PARTY' 
WHERE "appDataType" = 'PERSON_OR_CONTACT';

-- Update Ingestion Source Field Mappings
UPDATE source_field_mappings 
SET "transformType" = 'TO_PARTY_VALUE' 
WHERE "transformType" = 'TO_PERSON_OR_CONTACT_VALUE';

UPDATE source_field_mappings 
SET "transformType" = 'TO_PARTY_VALUE_LIST' 
WHERE "transformType" = 'TO_PERSON_OR_CONTACT_LIST';
