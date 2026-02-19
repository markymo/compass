# Supplier Onboarding & Relationship Activation Workflow  
*(Revised – Internal First, Collaborative Later)*

## Overview
This workflow describes how a Client (LE Admin) establishes and manages a relationship with a Supplier (e.g. a Bank) on the ONpro platform.

The design prioritises **low friction**, **immediate utility**, and **controlled collaboration**.  
Clients can begin managing a relationship unilaterally, without supplier involvement.  
Collaboration is an **optional upgrade**, activated explicitly and safely when needed.

---

## Core Philosophy: Internal First, Collaborative Later

The system **always starts in a private, client-only mode**.  
Collaboration is layered on top, rather than being a prerequisite.

This reflects real-world compliance workflows:
- Relationships exist before users
- Work begins before permissions are negotiated
- External parties may never log in

---

## Key Design Principles

* No external dependency to create value
* No irreversible actions
* Clear separation between **entity**, **relationship**, and **users**
* Explicit consent and auditability for all external access

---

## Workflow Stages

---

## Stage 1: Identification & Private Setup (Immediate)

**Goal:** Allow the LE Admin to start working instantly.  
**Trigger:** User clicks `+ Relationship` on the Legal Entity → Relationships tab.

### 1. Search & Select Supplier
- User searches a global directory (GLEIF, Companies House, internal entities).
- **Default path:** Create a **Stub Entity** if no clean match exists.
  - Required: Name, Country
  - Optional: Domain

> Stub entities are first-class citizens, not a fallback.

---

### 2. Relationship Creation
- System creates a `Relationship` record linking:
  - Client Legal Entity
  - Supplier Entity
- **State:** `CLIENT_ONLY`
- **Visibility:** Client users only  
- **Supplier is not notified**

---

### 3. Immediate Access
User is redirected to the **Relationship Dashboard** and can immediately:

- Upload legacy PDFs / Excel questionnaires
- Map internal data to the Master Schema
- Track status, tasks, deadlines
- Add private notes and internal-only commentary

**Value:**  
ONpro is immediately useful as a **Digital Filing Cabinet**, **Compliance Tracker**, and **Single Source of Truth**, even if the supplier never joins.

---

## Stage 2: Activation / External Invitation (Optional)

**Goal:** Invite a supplier contact to collaborate directly.  
**Trigger:** User clicks `Invite Supplier` on the Relationship Dashboard.

---

### 1. Permissions Gate
- System verifies user has `LE_ADMIN` role.
- Non-admin users cannot initiate external contact.

---

### 2. Invitation Form
User provides:
- **Email address** of supplier contact
- **Contact role** (e.g. Onboarding, Compliance, Legal)
- Optional personal message

Invitation metadata is stored independently of the relationship.

### 3. External View Preview
Before sending, the system shows a **Supplier View Preview**:

- ✔ Shared documents (count)
- ✔ Questionnaires / sections visible
- ✖ Internal notes (hidden)
- ✖ Private tasks (hidden)

This builds confidence and prevents accidental oversharing.

---

### 4. Confirmation & Audit Warning
User must explicitly confirm:

> *This will invite [email] to access shared documents and questionnaires for this relationship.  
> Ensure you are authorised to contact this individual.*

---

### 5. Invitation Sent
- Secure email invitation is sent
- **Relationship State:** `PENDING_EXTERNAL`
- Immutable audit log entry:
[UserID] invited [email] as [role] at [timestamp]


Client may resend or revoke the invitation while pending.

---

## Stage 3: Connection Established

**Goal:** Enable controlled, bidirectional collaboration.  
**Trigger:** Supplier accepts the invitation and registers/logs in.

---

### 1. Supplier Onboarding
- Supplier creates an account or links to an existing workspace.
- Invitation is bound to:
- Relationship
- Role
- Scoped permissions

---

### 2. Relationship State Update
- **State:** `CONNECTED`

---

### 3. Shared Workspace Activation
A shared layer becomes available:

- Documents, questionnaires, or fields explicitly marked as **Shared** become visible
- Supplier can:
- Complete assigned questionnaires
- Upload requested documents
- Respond to structured data requests

**Internal-only items remain hidden by default.**

---

## Relationship State Model

| State | Visibility | Description |
|------|-----------|-------------|
| **CLIENT_ONLY** | Client only | Internal filing, mapping, notes, legacy document management |
| **PENDING_EXTERNAL** | Client only | Invitation sent, awaiting supplier action |
| **CONNECTED** | Client + Supplier | Controlled collaboration via shared artefacts |
| **ARCHIVED** | Client only | Closed or historic relationship |

All state transitions are reversible except archival.

---

## Artefact-Level Visibility

Collaboration is **not all-or-nothing**.

Each artefact (document, questionnaire, data field) is independently scoped as:

- **Private** – client-only
- **Shared** – visible to supplier
- **Requested** – supplier must provide or complete

This supports partial, real-world workflows.

---

## Security & Audit Controls

- Only `LE_ADMIN` users can:
- Invite suppliers
- Revoke access
- Modify sharing scope
- Every invitation, acceptance, revocation, and scope change is:
- Timestamped
- User-attributed
- Immutable in audit logs
- Supplier access can be revoked at any time, reverting the relationship to `CLIENT_ONLY`.

---

## UX Highlight: Connect Call-to-Action

On `CLIENT_ONLY` relationships, a non-blocking prompt is shown:

> **Manage this relationship online?**  
> Invite your contact at **Barclays** to exchange documents and questionnaires securely.  
> [ Invite Supplier ]

This encourages collaboration without interrupting work.

---

## Summary

This workflow ensures:

- Immediate value without external dependency
- Safe, auditable collaboration when required
- Alignment with real compliance behaviour
- Scalability from unilateral use to networked reuse

ONpro works **even when counterparties do not**, and becomes more powerful when they do.
Do you like this personality?





