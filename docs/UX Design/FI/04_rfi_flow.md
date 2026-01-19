# FI RFI (Request for Information) Flow

**Goal**: Transform "Flagged" issues into a structured request for the client, reducing email back-and-forth.

## The Problem
Susan often finds 3-4 small errors (missing date, wrong signature, outdated document). Currently, she manually types an email listing these.

## The Solution: "One-Click Deficiency Notice"

### Step 1: Accumulate Flags
As Susan reviews in the **Workbench**, she flags items.
*   *Flagged*: "Certificate of Inc - Date is wrong."
*   *Flagged*: "Director List - Missing John Smith."

### Step 2: The "Request Changes" Action
Susan clicks [ **Request Changes (2 Items)** ] instead of [Approve].

### Step 3: The Review Modal
A modal appears, summarizing the request.

```
+-----------------------------------------------------------------------+
|  Request Information from Acme Hedge Fund                             |
|                                                                       |
|  The following items will be sent to Mark (Admin):                    |
|                                                                       |
|  [x] 1. Company Details > Date of Incorporation                       |
|      "Date on certificate is 2024, not 2023. Please clarify."         |
|                                                                       |
|  [x] 2. Directors > Director List                                     |
|      "Missing John Smith as per the org chart provided."              |
|                                                                       |
|  -------------------------------------------------------------------- |
|  Add a personal note (optional):                                      |
|  [ Hi Mark, just these two small things and we are good to go...    ] |
|                                                                       |
|                                      [ Cancel ] [ **Send Request** ]  |
+-----------------------------------------------------------------------+
```

### Step 4: The Outcome
1.  **Email Trigger**: Client receives an email: "Start-Up Bank requires 2 updates for Acme Hedge Fund."
2.  **Status Change**: Engagement status moves from **In Review** -> **Waiting for Client**.
3.  **SLA Pause**: The internal "Time to Review" clock pauses.

### Step 5: Client Experience (The Loop)
1.  Client clicks link in email.
2.  Lands on a simplified "Fix" page showing only the 2 flagged items.
3.  Client updates the date and uploads the new Org Chart.
4.  Submits.
5.  Susan gets notified: "Acme Hedge Fund - Updates Received."
6.  Status moves to **New Submission** (or "updates received").
