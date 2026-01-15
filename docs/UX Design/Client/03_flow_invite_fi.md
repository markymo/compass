# User Flow: Invite Financial Institution

## 1. Overview
This flow describes how a Client User (Project Manager) invites a Financial Institution (FI) to the platform to start sharing data.

## 2. Pre-conditions
- User is logged in as a Client Admin or Manager.
- User has permissions to manage "Relationships" (Engagements).

## 3. The "Invite Wizard" Steps

### Step 1: Search Directory (The "LinkedIn" Approach)
*   **Prompt**: "Who do you want to connect with?"
*   **Interaction**: User types "Bank of Amer..."
*   **System Logic**:
    *   Search Global Organization table (System-wide).
    *   *If Found*: Show "Bank of America" card with specific branches (e.g., "Global Custody", "Prime Brokerage").
    *   *If Not Found*: Show "Create New Invitation" option.

### Step 2: Configure Engagement
*   **Prompt**: "Which of your Funds/Entities is this for?"
*   **Input**: Multi-select dropdown of Client's Legal Entities (e.g., "Fund A", "Fund B").
*   **Context**: User can select "All Entities" or specific ones.

### Step 3: Define Contact (If New)
*   *Only shown if FI was not in directory OR if user wants to invite a specific person at the FI.*
*   **Fields**:
    *   Contact First Name
    *   Contact Last Name
    *   Email Address (Critical)
*   **Message**: Optional personal note. "Hi Bob, please use Compass to view our standing data."

### Step 4: Permissions Review
*   **Prompt**: "What can they see?"
*   **Default**: "Standard Read Access" (Can search and view published data).
*   **Advanced**: "Questionnaire Only" (Cannot browse, can only view assigned questionnaires).

## 4. Post-Action States

### Happy Path (Existing User)
*   **Status**: `PENDING APPROVAL`
*   **Notification**: Notification sent to FI Admin "Compass Client X wants to connect".

### Happy Path (New User)
*   **Status**: `INVITE SENT`
*   **Email**: Magic Link sent to `bob@bank.com`.
*   **Onboarding**: Bob clicks link, sets password, lands on "Pending Invites" page.

## 5. Edge Cases
*   **User Already Exists**: System warns "Bob@bank.com is already on Compass. We will just link him to this engagement."
*   **Domain Mismatch**: Warning if email is `@gmail.com`.
