# Design Concept: The Engagement Workbench (V2)

## The Philosophy: "Activity Streams"
Instead of generic buckets (Documents, Questionnaires), we organize by **User Intent**.
Alex wants to know two things:
1.  **"What do I owe them?"** (Inbound Requests, Questionnaires to fill)
2.  **"What do they have?"** (The 'Receipt' of shared data)

## Layout Structure
A **Split-Screen** or **Asymmetric Column** layout.

### 1. The Header (Relationship Status)
*   **Big status badge**: `READY TO TRADE` or `ONBOARDING`.
*   **"Magic" Action**: `Digitize Request` (The primary button).
    *   *Why?* Because usually Alex receives a PDF in email and comes here to deal with it.

### 2. Left Column: "Active Requests" (The Work)
*   This is the dynamic feed.
*   **Cards**: Each card is a questionnaire or request.
*   **Visual Priority**:
    *   *Urgent*: "KYC Refresh due in 2 days" (Red accent).
    *   *In Progress*: "Wolfeberg Questionnaire - 65%" (ProgressBar).
    *   *Completed*: moved to bottom or separate list.
*   **Call to Action**: "Resume", "Sign", "Submit".

### 3. Right Column: "Shared Intelligence" (The Asset)
*   **Concept**: This is the "Vault" specific to *this* bank.
*   **Sections**:
    *   **"Live Profile"**: Summary of data points they have access to (e.g., "Full Legal Name", "Directors").
    *   **"Shared Docs"**: List of PDFs explicitly shared.
*   **Visual**: Use a darker/softer background to denote "Storage" vs the bright "Active" left column.

## Component Draft (React)

```tsx
<div className="grid grid-cols-12 gap-8">
  {/* The Work Stream */}
  <div className="col-span-8 space-y-6">
     <SectionHeader title="Active Requests" action="Digitize New PDF" />
     <RequestCard status="overdue" />
     <RequestCard status="in-progress" />
  </div>

  {/* The Vault */}
  <div className="col-span-4 bg-slate-50 border-l p-6 -my-6 h-full"> 
     <H3>J.P. Morgan's View</H3>
     <DataSummaryItem label="Entity Details" status="Live" />
     <DataSummaryItem label="Financials" status="2023 Audited" />
     <DocumentsList />
  </div>
</div>
```
