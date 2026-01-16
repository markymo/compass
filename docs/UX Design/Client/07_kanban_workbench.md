# UX Design: Engagement Workbench (Kanban Mode)

**Core Concept**: Treat every Question/Data Point as a **Task** on a shared board.
The "Document" is just a container; the work happens at the atomic level.

## 1. The Workflow (Columns)
The board represents the lifecycle of an answer from "Draft" to "Agreed Truth".

### Phase 1: Client Private (The "War Room")
*   **Draft (AI / User)**:
    *   *Who*: Client Only.
    *   *What*: AI suggests answers based on Standing Data. Junior analysts input data.
    *   *Visual*: Grey/Ghosted cards.
*   **Internal Review**:
    *   *Who*: Client Manager (Alex).
    *   *What*: Alex reviews AI suggestions. He can "Flag" issues or "Assign" to a colleague ("Bob, do we have the 2024 Audit?").
    *   *Action*: "Sign Off" (Moves to Shared).

### Phase 2: The Handshake (Shared View)
*   **Shared / Pending Bank**:
    *   *Who*: Visible to Bank.
    *   *What*: The answer is "Proposed" to the bank.
    *   *Bank Action*:
        *   **Accept**: Moves to "Done".
        *   **Query**: Opens a chat thread on the card ("This date looks wrong"). Moves card back to "Query" state.

### Phase 3: The Truth
*   **Done (Approved)**:
    *   *What*: Both parties agree. This data is now "Golden".

## 2. The Card Anatomy
Each card represents one Question (e.g., "What is your LEI?").

### Front of Card
*   **Title**: The Question Text.
*   **Value**: The Answer (e.g., "549300...").
*   **Status Indicator**: User Avatar (Who is holding the ball?).
    *   *Thinking AI*: AI is drafting.
    *   *Alex's Face*: Needs Alex to review.
    *   *Bank Logo*: Waiting for Bank.
*   **Badges**: "Has Query", "Low Confidence".

### Back of Card (Modal/Expanded)
*   **Conversation**: Chat thread specific to this question.
    *   *Client Internal*: "Bob, is this right?" (Private).
    *   *External*: "JPM, we don't have this yet." (Public).
*   **History**: Who changed what, when.
*   **Source**: "Auto-filled from Standing Data (Matches 98%)".

## 3. Permissions & Privacy
*   **Unsigned Answers**: Strictly encrypted/visible only to Client Org.
*   **Signed Answers**: Re-encrypted for Shared scope (Client + Bank).

## 4. UI Layout (The Board)
*   **Header**:
    *   Questionnaire Selector (Switch between "Wolfsberg", "KYC Refresh").
    *   Progress Bar (Global status).
    *   Filters: "Show only my tasks", "Show Queries".
*   **The Board**:
    *   Horizontal scrolling columns.
    *   Drag and drop (where logic permits).

## 5. Implementation Strategy
We will build a `BoardView` component using `Hello Pangea DnD` (or similar) or just a simple grid to start.
1.  **Questionnaire Store**: Needs to track `status` per question.
2.  **Mock Data**: We need to generate ~20 questions in various states to test the UI.
