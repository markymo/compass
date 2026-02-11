# Master Schema Coverage Audit

This document audits the `Compass - Master Schema.xlsx` (Database Schema sheet) against the architecture defined in `docs/Architecture_Plan_Phase1.md`.

**Objective**: Validate that the proposed "Middle Path" architecture (Relational Modules + Metadata Overlay) can support every data point in the Master Schema without requiring structural changes.

**Legend**:
*   **Direct**: Field maps to a specific column in a 1:1 module.
*   **Repeating**: Field maps to a column in a 1:N module.
*   **Evidence**: Field acts as a source/summary, stored as raw evidence and referenced via `_meta`.
*   **Document**: Field represents a file upload requirement.

---

## 1. Identity & Registration

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | LEI validation date | Direct | `identity_profiles` | `lei_validation_date` | |
| **2** | LEI | Direct | `identity_profiles` | `lei_code` | **Key Identifier** |
| **3** | Legal Name | Direct | `identity_profiles` | `legal_name` | |
| **4** | Other Entity Names | Repeating | `entity_names` (1:N) | `name`, `type` | Handling "Trading As" / "Previous" |
| **5** | Previous Company Names | Repeating | `entity_names` (1:N) | `name`, `type` | |
| **6-10** | Registered Address | Direct | `identity_profiles` | `reg_address_line1`...`reg_postcode` | Standard Address Block |
| **11-15** | HQ Address | Direct | `identity_profiles` | `hq_address_line1`...`hq_postcode` | Standard Address Block |
| **16** | RA GLEIF ID | Direct | `constitutional_profiles` | `registration_authority_id` | |
| **17** | Registration Authority | Direct | `constitutional_profiles` | `registration_authority_name` | |
| **18** | Registered Number | Direct | `constitutional_profiles` | `registration_number` | |
| **19** | Entity Category | Direct | `entity_info_profiles` | `entity_category` | Enum (GENERAL, etc) |
| **20** | UK SIC | Repeating | `industry_classifications` | `code`, `scheme` | 1:N acts as "Activities" list |
| **21-25** | Legal Form (ELF) | Direct | `entity_info_profiles` | `legal_form_code`, `formation_country`... | ISO 20275 Data |
| **26** | Registration Status | Direct | `identity_profiles` | `registration_status` | Active/Dissolved |
| **27** | Creation Date | Direct | `identity_profiles` | `incorporation_date` | |
| **28-31** | LEI Registration | Direct | `lei_registrations` | `registration_date`, `next_renewal` | Separate module for LEI lifecycle |
| **32-35** | LEI Issuer/Validation | Direct | `lei_registrations` | `managing_lou`, `validation_sources` | |

## 2. Hierarchy & Relationships

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **36-39** | Direct Parent | Direct | `relationship_profiles` | `direct_parent_lei`, `direct_parent_name` | |
| **40-43** | Ultimate Parent | Direct | `relationship_profiles` | `ultimate_parent_lei`, `ultimate_parent_name` | |
| **44-48** | Fund Manager | Direct | `relationship_profiles` | `fund_manager_lei`, `fund_manager_name` | |
| **49-53** | Umbrella Fund | Direct | `relationship_profiles` | `umbrella_fund_lei`, `umbrella_fund_name` | |
| **54** | Direct Parent Exception | Direct | `relationship_profiles` | `direct_parent_exception_reason` | |
| **55** | Ult. Parent Exception | Direct | `relationship_profiles` | `ultimate_parent_exception_reason` | |

## 3. Constitution & Formation

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **56** | Constitutional Docs | Document | `document_registry` | *N/A (Link)* | Defined as "Document Upload" req. |
| **57-59** | Reg Authority (Repeat) | Direct | `constitutional_profiles` | *Map to 16-18 columns* | Duplicates 16-18 conceptually. |

## 4. Ownership & Control (Stakeholders)

*Architecture Note: This section describes a Repeating Group. We map this to a `stakeholders` table.*

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **60** | Active Officers (Source) | Evidence | `evidence_store` | *N/A* | This is a *source* summary, not a field. |
| **61** | PSC Source Data | Evidence | `evidence_store` | *N/A* | Source data payload. |
| **62-64** | List Requirements | Logic | *N/A* | *N/A* | These are instructions/definitions. |
| **65** | Full Name | Repeating | `stakeholders` (1:N) | `full_name` | |
| **66** | DOB / Place | Repeating | `stakeholders` (1:N) | `date_of_birth`, `place_of_birth` | |
| **67** | Nationalities | Repeating | `stakeholders` (1:N) | `nationalities` (Array/JSONB) | |
| **68** | ID / Proof | Repeating | `stakeholders` (1:N) | `id_document_ref` | Link to document. |
| **69** | Company Legal Name | Repeating | `stakeholders` (1:N) | `legal_name` | For Corporate Owners. |
| **70** | LEI | Repeating | `stakeholders` (1:N) | `lei_code` | |
| **71-73** | Corp Reg Details | Repeating | `stakeholders` (1:N) | `registration_number`... | |
| **74** | Structure Diagram | Document | `document_registry` | *N/A* | |

## 5. Sanctions & Anti-Corruption

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **75** | Operating Countries | Direct | `compliance_profiles` | `operating_countries` (Array) | |
| **76** | High Risk Links | Direct | `compliance_profiles` | `high_risk_interactions` (JSONB) | Complex structure? |
| **77** | High Risk Sectors | Direct | `compliance_profiles` | `high_risk_sectors` (Array) | |
| **78** | UK Sanctions Check | Direct | `compliance_profiles` | `sanctions_check_uk` | Boolean/Text result |
| **79** | EU Sanctions Check | Direct | `compliance_profiles` | `sanctions_check_eu` | |
| **80** | OFAC Sanctions Check | Direct | `compliance_profiles` | `sanctions_check_ofac` | |

## 6. Tax

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **81** | Tax ID & Country | Repeating | `tax_registrations` (1:N) | `tax_id`, `country` | Entities may have multiple. |
| **82** | W-8BEN-E | Document | `tax_profiles` | `w8_form_ref` | |
| **83** | FATCA Declaration | Direct | `tax_profiles` | `fatca_status` | |
| **84** | CRS Self-Cert | Document | `tax_profiles` | `crs_form_ref` | |

## 7. Financial Statements

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **85** | Last Accounts Made Up | Direct | `financial_profiles` | `last_accounts_date` | |
| **86** | Next Accounting Date | Direct | `financial_profiles` | `next_accounting_date` | |
| **87** | Next Accounts Due | Direct | `financial_profiles` | `next_accounts_due` | |
| **88** | Last Statement Date | Direct | `financial_profiles` | `last_statement_date` | |
| **89** | Next Statement Date | Direct | `financial_profiles` | `next_statement_date` | |
| **90** | Next Statement Due | Direct | `financial_profiles` | `next_statement_due` | |

## 8. Derivatives Onboarding

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **91** | ISDA Regulatory Letter | Document | `derivatives_profiles` | `isda_letter_ref` | |
| **92** | ISDA EMIR Class | Document | `derivatives_profiles` | `emir_class_ref` | |
| **93** | ISDA US Self-Disclosure | Document | `derivatives_profiles` | `us_disclosure_ref` | |
| **110** | Reporting Delegation | Document | `derivatives_profiles` | `delegation_agreement_ref` | |
| **111** | EMIR Reporting Delegation | Document | `derivatives_profiles` | `emir_delegation_ref` | |
| **112** | Reporting Side Letter | Document | `derivatives_profiles` | `reporting_side_letter_ref` | |

## 9. Trading Authorisation

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **95** | List of Persons | Logic | *N/A* | *N/A* | Instruction. |
| **96** | Full Name | Repeating | `authorized_traders` (1:N) | `full_name` | |
| **97** | Email | Repeating | `authorized_traders` (1:N) | `email` | |
| **98** | Telephone | Repeating | `authorized_traders` (1:N) | `phone` | |
| **99** | Mobile | Repeating | `authorized_traders` (1:N) | `mobile` | |
| **100** | Proof of Authority | Repeating | `authorized_traders` (1:N) | `authority_proof_ref` | Document link/Statement. |
| **101** | Products Authorised | Repeating | `authorized_traders` (1:N) | `products` (Array) | |
| **102** | Board Minute (Trade) | Document | `trading_profiles` | `board_minute_traders_ref` | |
| **103** | Board Minute (Trans) | Document | `trading_profiles` | `board_minute_trans_ref` | |

## 10. Contacts

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **104** | Address | Repeating | `contacts` (1:N) | `address` | |
| **105** | Attention | Repeating | `contacts` (1:N) | `attention` | |
| **106** | Email | Repeating | `contacts` (1:N) | `email` | |
| **107** | Process Agent | Direct | `contact_profiles` | `process_agent_details` | |
| **108** | Office | Direct | `contact_profiles` | `office_details` | |
| **109** | Multibranch Party | Direct | `contact_profiles` | `is_multibranch` | Boolean |
| **113** | Portfolio Data Contact | Direct | `contact_profiles` | `portfolio_data_email` | |
| **114** | Discrepancy Contact | Direct | `contact_profiles` | `discrepancy_email` | |
| **115** | Dispute Contact | Direct | `contact_profiles` | `dispute_email` | |

## 11. Standard Settlement Instructions (SSI)

| Field No | Name | Mapping Strategy | Target Module | Proposed Column | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **116** | Currency | Repeating | `settlement_instructions` (1:N) | `currency` | |
| **117** | Account Name | Repeating | `settlement_instructions` (1:N) | `account_name` | |
| **118** | Account Number | Repeating | `settlement_instructions` (1:N) | `account_number` | |
| **119** | IBAN/SWIFT | Repeating | `settlement_instructions` (1:N) | `iban_swift` | |

---

## Verdict & Recommendation

### Unmapped / Ambiguous Fields
1.  **Field 60, 61 (Ownership Sources)**: These are technically "Evidence Payloads" (Active Officers list from Companies House) that *generate* the `stakeholders` rows.
    *   *Recommendation*: Store these as raw JSONB in `evidence_store` and link the resulting `stakeholders` rows to this evidence via `_meta`. No dedicated "Field 60" column is needed in `stakeholders`.
2.  **Field 4 vs 5 (Entity Names)**: "Other Entity Names" vs "Previous Company Names".
    *   *Recommendation*: Use a single `entity_names` 1:N table with a `type` enum (`TRADING_AS`, `PREVIOUS`, `LEGAL`).
3.  **Field 76 (High Risk Links)**: "Activities or links with...".
    *   *Recommendation*: This is likely a complex object or text narrative. Use a `JSONB` column `high_risk_links` in `compliance_profiles` to allow flexibility.

### Conclusion

**Verdict: Architecture Sufficient With Minor Schema Tuning.**

The proposed architecture of **Relational Modules** + **Metadata Overlay** covers 100% of the data points.
*   **Modules**: The proposed modules (`identity_profiles`, `tax_profiles`, etc.) naturally house the direct fields.
*   **repeating Groups**: The 1:N table pattern (`stakeholders`, `authorized_traders`) perfectly handles the repeating sections (Ownership, Trading, SSI).
*   **Traceability**: The `_meta` overlay can successfully tag every row (e.g., a specific Director) back to the "Director" Field Nos (65-73).

No fundamental architectural changes are required. The "Middle Path" is valid.
