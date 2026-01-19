# FI Dashboard Wireframes (Susan's View)

## 1. The "Morning Triage" Dashboard
**Goal**: Help Susan prioritize her day by surfacing the most critical onboarding tasks.

### Concept: "SLA-Driven Kanban"
Susan organizes her work by "Stage" in the onboarding lifecycle.

**Layout**:
- **Global Header**: [ **Compass (FI)** ] [Search Entities...] [Notifications (3)] [Susan (Profile)]
- **Sidebar**: **Dashboard**, All Engagements, Knowledge Base (Golden Source), Settings.
- **Filters**: [ My Tasks ] [ Team Tasks ] | [ High Priority ] [ Approaching SLA ]

### Mockup
```
+--------------------------------------------------------------------------------------+
| COMPASS (FI) |  [ Search for Client, Fund, or Entity...       ]   [Notes] [Susan]    |
+--------------+-----------------------------------------------------------------------+
| DASHBOARD    |  Good Morning, Susan. You have 5 tasks requiring attention.           |
| [Engagements]|                                                                       |
| Knowledge    |  [ My Queue (12 Active) ]  [ Team View ]                              |
| Settings     |                                                                       |
|              |  +---------------------+  +---------------------+  +----------------+ |
|              |  | NEW SUBMISSION (3)  |  | IN REVIEW (5)       |  | RFI SENT (4)   | |
|              |  +---------------------+  +---------------------+  +----------------+ |
|              |  |                     |  |                     |  |                | |
|              |  | [!] Acme Hedge Fund |  |  Beta Capital Ltd   |  |  Gamma Corp    | |
|              |  | Fund A              |  |  Global Macro Fund  |  |  HoldCo        | |
|              |  | ------------------- |  |  ------------------ |  |  ------------- | |
|              |  | Rec'd: 2 hrs ago    |  |  Last: Yesterday    |  |  Waiting: 3d   | |
|              |  | SLA: < 24h Left     |  |  Progress: 85%      |  |  [Remind]      | |
|              |  | [Start Review >]    |  |  [Continue >]       |  |                | |
|              |  |                     |  |                     |  |                | |
|              |  +---------------------+  +---------------------+  +----------------+ |
|              |  |                     |  |                     |  |                | |
|              |  | Delta Ventures      |  |  Epsilon Partners   |  |                | |
|              |  | Series B            |  |  Main Fund          |  |                | |
|              |  | ------------------- |  |  ------------------ |  |                | |
|              |  | Rec'd: 4 hrs ago    |  |  Last: 2 days ago   |  |                | |
|              |  | [Start Review >]    |  |  [Continue >]       |  |                | |
|              |  +---------------------+  +---------------------+  +----------------+ |
+--------------+-----------------------------------------------------------------------+
```

## 2. Global "Entity Search"
If Susan isn't working from the queue, she's looking up a specific client.

**Action**: Typing "Acme" in the search bar.
**Result**: Dropdown showing:
-   **Acme Hedge Fund** (Entity - Onboarding COMPLETE)
-   **Acme Global Fund A** (Engagement - IN PROGRESS)
-   **Acme Management Co** (Entity - Onboarding COMPLETE)

This distinction between "Entity" (Golden Record) and "Engagement" (Specific context/onboarding event) is crucial.
