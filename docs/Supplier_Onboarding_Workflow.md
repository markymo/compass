# Supplier Onboarding & Relationship Activation Workflow

## Overview
This workflow describes how a Client (LE Admin) onboards a Supplier (e.g., a Bank) to the Compass platform. 
The design prioritizes **low friction** and **immediate utility**. Users can start managing a relationship instantly without requiring the supplier's active participation (Scenario 1). The relationship can be "upgraded" to a collaborative state (Scenario 2) at any time via an explicit invitation.

## Core Philosophy: "Internal First, Collaborative Later"

Instead of asking the user to choose between "Internal" or "Collaborative" modes upfront, the system **always** starts in Internal Mode. The "Collaboration" features are treated as an optional layer that can be activated when needed.

---

## Workflow Stages

### Stage 1: Identification & Internal Setup (Immediate)
**Goal:** Allow the LE Admin to start working immediately.
**Trigger:** User clicks `+ Relationship` on the Legal Entity Relationships tab.

1.  **Search & Select**:
    *   User searches the global directory (GLEIF, Companies House, or existing local database) for the Supplier (e.g., "Barclays Bank").
    *   *Fallback*: If not found, User creates a "Stub Entity" (Name, Country, optional domain).
2.  **Creation**:
    *   System creates a `Relationship` record linking the Client LE to the Supplier.
    *   **Status**: `INTERNAL_MANAGED` (or `DRAFT`).
    *   **Visibility**: Visible ONLY to the Client. The Supplier is NOT notified.
3.  **Immediate Access**:
    *   User is redirected to the **Relationship Dashboard**.
    *   User can now:
        *   Upload existing PDF/Excel questionnaires.
        *   Map internal data to Master Schema.
        *   Add private notes and tasks.

*Value Prop*: The system is immediately useful as a "Digital Filing Cabinet" and "Compliance Tracker" even if the bank never logs in.

---

### Stage 2: Activation / Deepening the Relationship (Optional)
**Goal:** Invite the supplier to collaborate directly (e.g., to fill out a digital questionnaire or review documents).
**Trigger:** User clicks prominent `Connect with Supplier` or `Invite Contact` button on the Relationship Dashboard.

1.  **Permissions Check**:
    *   System verifies the current user has `LE_ADMIN` role. (Regular users cannot inititate external contact).
2.  **Invitation Form**:
    *   User enters the **Email Address** of the supplier contact (e.g., `onboarding@barclays.com`).
    *   *Optional*: User adds a personal message.
3.  **Confirmation & Audit**:
    *   System displays a clear warning: *"This will invite [Email] to view shared documents and questionnaires. Ensure you have authority to contact this individual."*
    *   User confirms.
4.  **Execution**:
    *   System sends a secure email invitation.
    *   **Status**: Updates to `INVITE_SENT`.
    *   **Audit Log**: Records `[User ID]` invited `[Email]` at `[Timestamp]`.

---

### Stage 3: Connection Established
**Goal:** Supplier joins and data exchange becomes bidirectional.
**Trigger:** Supplier clicks the link in the email and registers/logs in.

1.  **Onboarding**: Supplier creates an account (if new) or links the relationship to their existing workspace.
2.  **Status Update**:
    *   **Status**: Updates to `ACTIVE` / `COLLABORATIVE`.
3.  **Shared Workspace**:
    *   A generic "Shared" area becomes available.
    *   Items marked as "Shared with Supplier" become visible to them.
    *   Internal notes and private documents remain hidden.

---

## User Experience (UX) Highlights

### The "Connect" Call-to-Action
On the Dashboard of an `INTERNAL_MANAGED` relationship, a prominent card or banner encourages connection without blocking work:

> **Manage this Relationship Online?**
> Invite your contact at **Barclays** to exchange documents and questionnaires directly securely.
> [ Invite Supplier ]

### Audit & Security
*   **Gatekeeper**: Only `LE_ADMIN` can send invites.
*   **Traceability**: Every invitation is an immutable audit log event.
*   **Revocation**: The LE Admin can "Disconnect" the supplier at any time, reverting the relationship to `INTERNAL_MANAGED` and revoking external access.

---

## Summary of States

| State | Who sees it? | Activity |
| :--- | :--- | :--- |
| **Internal Managed** | Client Only | Internal filing, mapping legacy docs, private notes. |
| **Invite Sent** | Client Only | Waiting for supplier. Client can resend/cancel invite. |
| **Active / Connected** | Client & Supplier | Shared documents, digital questionnaire filling, messaging. |

