# Invitation & Onboarding Flow

*Last Updated: April 2026*

---

## Overview

The invitation system controls how users are granted access to Compass entities — Organisations (Orgs), Legal Entities (LEs), and Supplier Engagements (ENGs). It implements a **strict, delegation-based authority model** to prevent privilege escalation, and intelligently forks its internal flow depending on whether the recipient is a new or already-registered user.

---

## Key Principles

- **Exactly one scope per invitation** — every invitation targets one of: an Org, an LE, or an Engagement.
- **Delegation cannot exceed authority** — you can only grant a role you are authorised to grant.
- **Strict email match** — an invitation can only be accepted by the exact email address it was sent to.
- **Intelligent routing** — if the invitee already has a Compass account, the system skips token generation and directly provisions access. No email link required.
- **Token security** — raw tokens are never stored. A SHA-256 hash is stored in the database; the raw token lives only in the email.

---

## Roles

| Role | Scope | Description |
|------|-------|-------------|
| `SYSTEM_ADMIN` | Platform | Full platform access. Can do everything. |
| `ORG_ADMIN` | Organisation | Manage billing, users, LE creation. No LE data access for LEs they haven't joined. |
| `ORG_MEMBER` | Organisation | Base membership state. Can view relationships. |
| `LE_ADMIN` | Legal Entity | Full LE data access, sign-off, invite LE users. |
| `LE_USER` | Legal Entity | Edit and view LE data. Cannot sign off. |
| `SUPPLIER_CONTACT` | Engagement | External contact associated with a supplier engagement. |

---

## Delegation Rules

Who can invite whom is governed by a delegation table (`invitations.ts: DELEGATION_TABLE`). Both the inviter's **scope** and the **target role** must match a valid entry:

| Scope | Target Role | Required Action | Who Can Do This |
|-------|-------------|-----------------|-----------------|
| ORG | `ORG_ADMIN` | `org:manage_team` | SYSTEM_ADMIN only |
| ORG | `ORG_MEMBER` | `org:manage_team` | ORG_ADMIN |
| LE | `LE_ADMIN` | `le:manage_users` | ORG_ADMIN, or LE_ADMIN of that LE |
| LE | `LE_USER` | `le:manage_users` | ORG_ADMIN, or LE_ADMIN of that LE |
| ENG | `SUPPLIER_CONTACT` | `le:manage_users` | ORG_ADMIN, or LE_ADMIN owning the engagement |

> `SYSTEM_ADMIN` bypasses all delegation checks and can always invite anyone to any scope.

---

## Sending an Invitation: Server-Side Flow (`inviteUser`)

**Entry point:** `src/actions/invitations.ts` → `inviteUser(payload)`

```
Trigger: Admin submits the "Add User" form on the LE Overview or Org Team tab.
```

### Step-by-step

```
1. Authentication check
   └─ Caller must be logged in (getIdentity()).

2. Scope validation
   └─ Exactly one of organizationId / clientLEId / fiEngagementId must be set.
   └─ Returns error if none or multiple are provided.

3. Delegation check
   ├─ Build key: "{scopeType}_{role}" (e.g. "LE_LE_USER")
   ├─ Look up required Action in DELEGATION_TABLE.
   ├─ If SYSTEM_ADMIN → skip all checks.
   └─ Otherwise → call can(user, requiredAction, context, prisma).
      └─ can() checks: direct membership, ownership inheritance.
      └─ Extra gate: only SYSTEM_ADMIN can grant ORG_ADMIN.

4. Duplicate check
   └─ If an active (not used, not revoked) invitation for the same
      email + scope already exists → return error.

5. User lookup + member check
   └─ Query users table for the target email.
   ├─ If a membership already exists in the target scope → return error.

   ┌────────────────────────────────────┐
   │  FORK: Existing User?              │
   ├────────────────────────────────────┤
   │  YES → Path A: Auto-Add (↓)        │
   │  NO  → Path B: Token Flow (↓)      │
   └────────────────────────────────────┘
```

---

### Path A: Auto-Add (Existing Platform User)

The recipient already has a Compass account.

```
6a. Create Membership record directly.
    └─ Writes: userId, organizationId or clientLEId, role

7a. (Engagement scope only) Update engagement status → CONNECTED.
    Write engagement activity log.

8a. Resolve a dashboard URL for the recipient:
    └─ Org scope  → /app/clients/{orgId}
    └─ LE scope   → /app/le/{leId}
    └─ Eng scope  → /app/s/{fiOrgId}

9a. Send "You've been granted access" notification email via Resend.
    From: noreply@app.coparity.tech
    Subject: "You have been granted access to {scopeLabel}"
    Link:  Direct to their dashboard (no /invite token needed).

10a. Log activity (TEAM_MEMBER_INVITED + note "Auto-Added Existing User").
     Log platform usage (USER_ADDED_DIRECTLY).
     revalidatePath for the relevant team/LE pages.

→ Returns: { success: true, message: "User {email} was found and instantly granted access." }
```

---

### Path B: Token Flow (New / Unknown User)

The recipient does not yet have a Compass account.

```
6b. Generate a cryptographically random UUID (rawToken).
    Hash it: SHA-256(rawToken) → tokenHash.
    Set expiry: 7 days from now.

7b. Create Invitation record:
    └─ sentToEmail, role, tokenHash, expiresAt, createdByUserId
    └─ organizationId / clientLEId / fiEngagementId (one populated)

8b. Resolve human-readable scope label and inviter name.

9b. Render TeamInviteEmail template.
    Send via Resend:
      From:    noreply@app.coparity.tech
      To:      payload.email
      Subject: "You've been invited to join {scopeLabel}"
      Link:    {NEXT_PUBLIC_APP_URL}/invite/{rawToken}

    Note: If Resend fails, the invitation record is still created.
    Email failure is logged but does not fail the action.

10b. Log activity (TEAM_MEMBER_INVITED).
     Log platform usage (INVITATION_SENT).
     revalidatePath for relevant pages.

→ Returns: { success: true, message: "Invitation sent to {email}." }
```

---

## Accepting an Invitation: The `/invite/[token]` Flow

The invite URL format is: `https://app.coparity.tech/invite/{rawToken}`

This page lives **outside** the `(platform)` route group and is **publicly accessible** (whitelisted in `src/proxy.ts`).

### Server-side page render (`page.tsx`)

```
1. Hash the URL token: SHA-256(rawToken) → tokenHash.
2. Look up Invitation by tokenHash, including related org/LE/engagement.
3. Validate: must exist, not revoked, not used, not expired.
   └─ If invalid → show "Invalid Invitation" error card. Stop.
4. Check session: is the visitor logged in? (getIdentity())
5. If ?autoAccept=1 is in the URL AND user is logged in:
   └─ Call acceptInvitation(token) server-side.
   └─ On success → redirect(redirectUrl). Done.
6. Otherwise → render the invitation card with <InvitationAcceptFlow>.
```

---

### Client component: `<InvitationAcceptFlow>`

This client component handles three distinct UI states:

#### State 1: Logged in, correct email
Shows a single "Accept Invitation" button.  
On click → calls `acceptInvitation(token)` → on success → `router.push(redirectUrl)`.

#### State 2: Logged in, wrong email (mismatch)
Shows an amber warning box explaining the mismatch.  
Shows "Sign Out to Continue" button.  
On click → `signOut({ redirect: false })` → `window.location.reload()`.  
Page reloads as logged-out, falling into State 3 below.

#### State 3: Not logged in (new user)
Shows a green welcome box:
> *"Thanks for accepting your invitation! We've set up an account for you to access {scopeName} as a {role}. Set your password below to continue."*

Shows a single **Password** field (email is locked to the invited address).  
Shows "Set Password & Continue" button.

On submit:
```
1. registerUser({ name: derived from email prefix, email, password, token })
   └─ If token matches a valid invitation for this email → emailVerified = now.
   └─ Creates user with hashed password.

2. signIn("credentials", { email, password, redirect: false })
   └─ Establishes the session cookie.

3. window.location.href = /invite/{token}?autoAccept=1
   └─ Hard redirect forces a new HTTP request carrying the new session cookie.
   └─ Server page detects autoAccept=1, calls acceptInvitation() server-side.
   └─ redirect() to the dashboard.
```

Also shows: "Already have an account? Sign in to your existing account" link.

---

### Core acceptance logic (`acceptInvitation`)

**Entry point:** `src/actions/accept-invitation.ts`

```
1. Hash token → look up Invitation.
2. Validate: not used, not revoked, not expired.
3. Determine scope: ORG / LE / ENG.
4. Auth check: getIdentity() must return a logged-in user.
   └─ If no session → return { requiresAuth: true } (no crash).
5. Strict email check: session email must exactly match sentToEmail.
   └─ If mismatch → return error message (shown in UI, no crash).
6. Create Membership (idempotent — checks for existing first):
   ├─ ORG scope → Membership(userId, organizationId, role)
   ├─ LE scope  → Membership(userId, clientLEId, role)
   └─ ENG scope → Membership(userId, fiOrgId, role)
                  + update FIEngagement status → CONNECTED
                  + write EngagementActivity(INVITE_ACCEPTED)
7. Mark invitation as used: usedAt = now, acceptedByUserId = userId.
8. Determine redirect URL:
   ├─ ORG scope → /app/clients/{orgId}
   ├─ LE scope  → /app/clients/{ownerId} or /app/le/{leId}
   └─ ENG scope → /app/s/{fiOrgId}
9. Return { success: true, redirectUrl }.
```

---

## Email Infrastructure

| Setting | Value |
|---------|-------|
| Provider | Resend |
| Sending domain | `app.coparity.tech` |
| From address | `noreply@app.coparity.tech` |
| DNS | SPF, DKIM configured on subdomain |
| Template | `TeamInviteEmail` (React Email) |
| API Key | `RESEND_API_KEY` environment variable |
| Base URL | `NEXT_PUBLIC_APP_URL` (must be set in Vercel) |

> Using a subdomain (`app.`) isolates email deliverability reputation from the main `coparity.tech` domain.

---

## Middleware Route Protection

Route protection is handled by `src/proxy.ts`, which wraps NextAuth's `auth()` as Next.js middleware. Any unauthenticated request to a non-whitelisted path is redirected to `/login`.

**Public (unprotected) paths — exempt from redirect:**
- `/api/*`
- `/_next/*` (static assets)
- `/login`
- `/invite/*` ← **critical: invitation links must be publicly accessible**
- `/about`, `/privacy`, `/terms`, `/contact`, `/how-it-works`, `/partner`
- Site root `/`

---

## Token Security Model

| Property | Implementation |
|----------|---------------|
| Token format | UUID v4 (cryptographically random) |
| Storage | SHA-256 hash only — raw token never persisted |
| Transmission | Raw token in email link only |
| Verification | Hash the incoming URL token, look up by hash |
| Expiry | 7 days |
| One-time use | `usedAt` timestamp set on acceptance |
| Revocation | `revokedAt` timestamp set by admin |
| Email binding | Strict — `sentToEmail` must match authenticated user's email |

---

## Key Files Reference

| File | Responsibility |
|------|---------------|
| `src/actions/invitations.ts` | Sending invitations (`inviteUser`), pending invite queries |
| `src/actions/accept-invitation.ts` | Consuming a token and creating membership |
| `src/actions/auth-register.ts` | New user registration (token-linked email verification) |
| `src/app/invite/[token]/page.tsx` | Public invitation landing page (server component) |
| `src/components/client/invitation-accept-flow.tsx` | Client UI for registration/acceptance/mismatch |
| `src/lib/auth/permissions.ts` | `Role` enum, `Action` enum, delegation `can()` function |
| `src/proxy.ts` | Next.js middleware — route protection and public allowlist |
| `src/components/emails/team-invite-email.tsx` | Transactional email template |
