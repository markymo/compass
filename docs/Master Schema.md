# The Dual Master Schema Concept

The "Master Schema" in Compass is not a single entity but a dual-concept system designed to bridge the gap between **what an entity IS** (Data) and **what an entity is ASKED** (Questions).

## 1. The Data Master Schema (The "Truth")
This schema represents the **absolute state** of a Legal Entity. It is a comprehensive, structured data model that defines every possible attribute of a company.

*   **Purpose**: To act as the "Single Source of Truth."
*   **Structure**: Hierarchical, typed data (JSON/Relation).
*   **Content**:
    *   *Identity*: Name, LEI, Registration Number.
    *   *Addresses*: Registered, Mailing, HQ.
    *   *People*: Directors, UBOs, Signatories.
    *   *Financials*: Turnover, Tax Residency, Bank Accounts.
    *   *Documents*: Certificate of Incorporation, Articles of Association.

**Key Characteristic**: This usage is **agnostic** of who is asking. It describes the entity in a vacuum.

## 2. The Question Master Schema (The "Interface")
This schema represents the **universe of possible questions** that Financial Institutions (FIs) and other partners might ask to obtain information about an entity.

*   **Purpose**: To elicit data from the client to populate the Data Master Schema.
*   **Structure**: Linear or branching logic, text-based prompts.
*   **Content**:
    *   "What is your company's legal name?"
    *   "Please list all directors with >25% shareholding."
    *   "Are you a US Person for tax purposes?"

**Key Characteristic**: This usage is **subjective** and **variable**. Different FIs will phrase the same request differently.

---

## The Relationship: The "Golden Rule" of Answerability

The fundamental principle governing these two schemas is:

> **"If the Data Master Schema is completely filled in, ANY question from ANY questionnaire can be answered derived from it."**

### The Mapping Challenge (Not 1:1)
Crucially, the relationship between Questions and Data is **Complex (Many-to-Many)**, not simple (1:1).

1.  **Aggregation (Many Data -> 1 Question)**
    *   *Question*: "Please provide a summary of your board structure and key controllers."
    *   *Data Needed*: `Directors List` + `UBO List` + `Shareholding Structure`.

2.  **Disaggregation (1 Data -> Many Questions)**
    *   *Data*: `Tax Residency: UK`.
    *   *Question A*: "Are you tax resident in the UK?" (Yes)
    *   *Question B*: "Are you tax resident in the US?" (No)

3.  **Semantic Variance (The "Rosetta Stone" Problem)**
    *   *Supplier A*: "Who are your Beneficial Owners?"
    *   *Supplier B*: "List all individuals who ultimately own or control more than 25% of the entity's shares or voting rights."
    *   *Underlying Data*: The `UBO List` handles both, but the *mapping* logic must understand that these questions are equivalent requirements.

## Implementation Implication
Our system must focus on **populating the Data Master Schema** first.
*   Questionnaires are mechanisms to *fill* the Data Schema.
*   Once the Data Schema has enough "density," the system can auto-generate answers for new questionnaires by projecting the Data Schema onto the specific questions asked.
