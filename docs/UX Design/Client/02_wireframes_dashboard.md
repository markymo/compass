# Client Dashboard Wireframes

## 1. Engagement (Relationships) Dashboard
This page list the Financial Institutions the client has connected with.

### Concept: "The Command Center" (Context: Acme Global Fund A)
**Layout**:
- **Global Header**: [ **Fund: Acme Global Fund A v** ]  [Search]  [Profile]
- **Sidebar**: Dashboard, **Relationships**, Documents, Settings.
- **Main Area**: "Active Engagements" for this specific Fund.

### Mockup
```
+----------------------------------------------------------------------------------+
| COMPASS |  [ LE: Acme Global Fund A v ]                    [Mark (Admin)]        |
+---------+------------------------------------------------------------------------+
| DASH    |  Relationships (Acme Global Fund A)            [+ Connect new FI]      |
| [REL.]  |                                                                        |
| DOCS    |  [ All (12) ]  [ Pending (2) ]  [ Active (10) ]                        |
| SETTINGS|                                                                        |
|         |  +---------------------------+  +---------------------------+          |
|         |  | JP Morgan Chase           |  | Bank of America           |          |
|         |  | Status: ACTIVE            |  | Status: ACTION REQUIRED   |          |
|         |  | ------------------------- |  | ------------------------- |          |
|         |  | Forms: 3 Shared           |  | Msg: "Please update ESG"  |          |
|         |  | [View Details]            |  | [View Details]    (1)     |          |
|         |  +---------------------------+  +---------------------------+          |
|         |                                                                        |
|         |  +---------------------------+  +---------------------------+          |
|         |  | Goldman Sachs             |  | Wells Fargo               |          |
|         |  | Status: PENDING           |  | Status: ACTIVE            |          |
|         |  | ------------------------- |  | ------------------------- |          |
|         |  | Sent: 2 days ago          |  | Forms: 2 Shared           |          |
|         |  | [Resend Invite]           |  | [View Details]            |          |
|         |  +---------------------------+  +---------------------------+          |
+---------+------------------------------------------------------------------------+
```

## 2. Engagement Detail (The "Workbench")
When user clicks "View Details" (1).

### Concept: "One Place for Everything"
**Breadcrumb**: Fund A > Bank of America
**Tabs**: Overview | **Questionnaires** | Documents | Team

### Mockup (Questionnaires Tab)
```
+----------------------------------------------------------------------------------+
| < Back  |  Bank of America (Global Custody)              [Manage Permissions]    |
+---------+------------------------------------------------------------------------+
|         |  [Overview]  [**Questionnaires**]  [Documents]                         |
|         |                                                                        |
|         |  Active Questionnaires (2)                 [+ Add Questionnaire]       |
|         |                                                                        |
|         |  +--------------------------------------------------------+            |
|         |  | Wolfsberg CBDQ v1.4                                    |            |
|         |  | Source: [FI-Published]                                 |            |
|         |  | Status: [Completed] (Auto-filled 98%)                  |            |
|         |  | [Download PDF]  [Edit Answers]                         |            |
|         |  +--------------------------------------------------------+            |
|         |                                                                        |
|         |  +--------------------------------------------------------+            |
|         |  | BoA ESG Addendum (Custom)                              |            |
|         |  | Source: [Client-Digitized]                             |            |
|         |  | Status: [Draft] (Missing 5 answers)     [Edit]         |            |
|         |  +--------------------------------------------------------+            |
+---------+------------------------------------------------------------------------+
```

## 3. The "Add Questionnaire" Modal
Triggered by [+ Add Questionnaire].

### Concept: "The Fork in the Road"
Gives the user two clear paths: Use a standard form or digitize a new one.

### Mockup
```
+---------------------------------------------------------------+
|  Add Questionnaire to Bank of America                         |
|                                                               |
|  [ Option A: Select from Library ]                            |
|  Search standard industry forms...                            |
|  [ Wolfsberg v1.4 ]  [ SIG Lite ]  [ AIMA DDQ ]               |
|                                                               |
|  -------------------- OR ------------------------------------ |
|                                                               |
|  [ Option B: Digitize New Form ]                              |
|  Upload a PDF or Word document sent by the bank.              |
|  We will extract the questions for you.                       |
|  [  Drag & Drop File Here  ]                                  |
|                                                               |
|                                       [Cancel] [Next >]       |
+---------------------------------------------------------------+
```
