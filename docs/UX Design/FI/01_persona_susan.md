# Person: Susan, Compliance Officer

**Role**: Senior Compliance Analyst at a mid-to-large sized Financial Institution (Bank).
**Goal**: Efficiently review, validate, and approve client onboarding (KYC/AML) and digitize incoming data to populate the bank's internal systems.

## Context
Susan is overwhelmed. She has 50+ onboardings in flight. Currently, this process involves:
1.  Receiving PDFs/Excel sheets via email.
2.  Manually checking if the data matches public records (Companies House, etc.).
3.  Manually typing this data into the bank's "Core Banking" system.
4.  Emailing the client back with "Missing signatures" or "Wrong date".

## Compass Value Proposition for Susan
Compass acts as the **cleaning layer**. It ensures that by the time Susan sees the data, it is structured, validated, and ready for a final "human-in-the-loop" approval before flowing into the core system.

---

## Core Tasks (Jobs to be Done)

### 1. The Morning Triage (Dashboard)
Susan needs a high-level view of her workload. She doesn't want to see *everything*, just what needs her attention *now*.

*   **Task**: Identify which Engagements have moved status (e.g., "Client Responded", "New Submission").
*   **Metric**: "Time to First Review".
*   **UI Needs**:
    *   **Kanban or List View**: Grouped by status (e.g., "Inbox", "In Review", "Waiting for Client", "Ready for Approval").
    *   **Priority Indicators**: High value clients or SLA breaches.

### 2. The Deep Dive (Engagement Workbench)
Once she picks a file, she enters the "Workbench". This is where she spends 80% of her time.

*   **Task**: Validate submitted data against evidence.
*   **Workflow**:
    1.  **View Source vs. Extracted**: See compliance questionnaire answers side-by-side with the supporting documents (e.g., Answer: "Incorporated in UK" vs. Certificate of Incorporation PDF).
    2.  **Verify/Flag**: precise interaction. Click a field, see the source highlight. Mark as "Verified" (Green) or "Flag Issue" (Red).
    3.  **Remediate**: If data is wrong, she can either:
        *   *Fix it herself* (if minor, like a typo).
        *   *Return to Client* (if material, like missing beneficiary owner).

### 3. Digitizing "Messy" Input
Sometimes clients just email a dump of PDFs. Susan needs to turn this unstructured mess into structured data.

*   **Task**: Drag-and-drop a PDF and have Compass AI extract the key fields.
*   **Workflow**: Upload -> AI Scan -> Review/Confirm Suggestions -> Save to Profile.

### 4. Client Communication (RFI - Request for Information)
Susan hates composing emails. She wants to just tick boxes on what's wrong and have the system send a polite, formal request.

*   **Task**: Send a "Deficiency Notice".
*   **Workflow**: Select 3 flagged items -> Click "Request Updates" -> System notifies client "Action Required".

### 5. Managing "Standing Data" (The Golden Record)
Susan is building a library of facts about entities.

*   **Task**: Check if a client (e.g., "Acme Corp") has already been onboarded by another division.
*   **Workflow**: Search Knowledge Base -> "Ah, we already have their Articles of Association from 2024" -> Reuse -> Skip request.

---

## Key Emotions
*   **Anxiety**: Missing a risk factor (Sanctions list hit).
*   **Frustration**: Formatting issues, unreadable scans.
*   **Relief**: specific validation ("All checks passed").
