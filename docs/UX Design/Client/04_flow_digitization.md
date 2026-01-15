# User Flow: Questionnaire Digitization (The "Magic" Import)

## 1. Overview
This is the "Wow" feature. A user uploads a static PDF/Word document, and the system converts it into an interactive Compass Questionnaire, ready for auto-filling.

## 2. Trigger
User clicks "Add Questionnaire" -> "Upload Document" inside an Engagement or Library.

## 3. The Workflow

### Step 1: Upload & Analyze
*   **UI**: Dropzone. Accepts .PDF, .DOCX.
*   **System Action**:
    *   Upload file.
    *   Trigger `extraction-service`.
    *   Show "Scanning..." animation (3-10 seconds).
    *   *Transition*: Move to "Workbench".

### Step 2: The Extraction Workbench (Review Mode)
*   **Layout**: Split Screen.
    *   **Left**: PDF Viewer (rendered).
    *   **Right**: Extraction List (Editable Inputs).
*   **User Task**: Verify the AI got it right.
*   **Key Interactions**:
    *   **Visual Correspondence**: Hovering a question on the right highlights the text on the left.
    *   **Missed Questions**: User clicks text in PDF -> "Add as Question".
    *   **Garbage Clean**: User deletes headers/footers mistakenly identified as questions.

### Step 3: Mapping & Pre-Fill (Auto-Run)
*   **Trigger**: User clicks "Confirm & Digitize".
*   **System Action**:
    *   Save structure (Sections, Questions).
    *   **Run Auto-Fill Agent**: Match questions against Landing Data.
*   **UI Feedback**: Progress bar "Searching Knowledge Base...", "Drafting Answers...".

### Step 4: The Answer Review
*   **Context**: Now the user is looking at the *Digitized* Questionnaire, but instead of empty fields, it's populated.
*   **Indicators**:
    *   🟢 High Confidence match from Standing Data.
    *   🟡 Medium Confidence (Check this).
    *   🔴 No Data / Hallucination Risk.
*   **Action**: User approves answers.

## 4. Technical Requirements for UI
*   High-fidelity PDF rendering (e.g., `react-pdf`).
*   Text selection listener in PDF viewer.
*   Real-time WebSocket or Polling for "Extraction" status.
