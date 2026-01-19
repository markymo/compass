# FI Engagement Overview (Susan's Client View)

## Concept: "The Project Page"
Once Susan clicks on a specific engagement (e.g., "Acme Hedge Fund"), she enters this view. It is the single source of truth for *this specific onboarding*.

**Goal**: "Where do we stand with Acme?"
1.  See overall progress (%).
2.  See list of all requirements (Questionnaires, Documents).
3.  Identify blockers (missing docs, unanswered questions).
4.  Launch the "Workbench" for specific items.

## Mockup

```
+--------------------------------------------------------------------------------------+
| < Back to Dashboard |  **Acme Hedge Fund** (Fund A)          [Actions v] [ **Approve** ] |
+--------------------------------------------------------------------------------------+
|                                                                                      |
|  [ STATUS: IN PROGRESS ]   [ SLA: 2 Days Left ]   [ Assg: Susan ]                    |
|  Progress: [=========-------] 65%                                                    |
|                                                                                      |
|  +--------------------------------------------------------------------------------+  |
|  | REQUIREMENTS LIST (The Checklist)                                              |  |
|  | Filter: [ All ] [ To Review (2) ] [ Completed ]                                |  |
|  |                                                                                |  |
|  | DOCUMENT / FORM                     SOURCE              STATUS       ACTION    |  |
|  | ----------------------------------  ------------------  -----------  --------- |  |
|  | 1. Certificate of Incorporation     [cert_inc.pdf]      [REVIEW]     [Review >]|  |
|  |    *AI extracted 12 fields*                                                    |  |
|  |                                                                                |  |
|  | 2. Wolfsberg CBDQ v1.4              [Digital Form]      [REVIEW]     [Review >]|  |
|  |    *Client submitted yesterday*                                                |  |
|  |                                                                                |  |
|  | 3. Authorised Signatory List        [sig_list.pdf]      [FLAGGED]    [View]    |  |
|  |    *(!) Missing signature pg 3*                                                |  |
|  |                                                                                |  |
|  | 4. Annual Report (2024)             [Pending Upload]    [WAITING]    [Remind]  |  |
|  | ----------------------------------  ------------------  -----------  --------- |  |
|  +--------------------------------------------------------------------------------+  |
|                                                                                      |
|  +---------------------------+  +---------------------------+                        |
|  | LATEST ACTIVITY           |  | AI INSIGHTS               |                        |
|  | ------------------------- |  | ------------------------- |                        |
|  | Today, 09:30 AM           |  | - Entity matches "Acme"   |                        |
|  | Client uploaded 'cert...' |  |   in Knowledge Base.      |                        |
|  |                           |  | - directors match Sanctions|                        |
|  | Yesterday, 4:00 PM        |  |   List clean (0 hits).    |                        |
|  | Mark (Admin) replied to   |  |                           |                        |
|  | query re: Owners.         |  |                           |                        |
|  +---------------------------+  +---------------------------+                        |
+--------------------------------------------------------------------------------------+
```

## Workflow
1.  **Dashboard** -> Click "Acme Hedge Fund".
2.  **Engagement Overview** (This Page) -> See 4 items, 2 need review.
3.  Click "Review >" on *Certificate of Incorporation*.
4.  **Workbench** (Split Screen Document View) -> Validate fields.
5.  **Back** -> Returns here. Item 1 is now "Approved".
