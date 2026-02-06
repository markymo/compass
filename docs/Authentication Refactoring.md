# Authentication Refactoring

## 1. Current State (Clerk + JIT Sync)

We currently use **Clerk** as our Identity Provider (IdP) but maintain our own authorization and user database.

### Architecture
- **Identity Provider**: Clerk handles Sign Up, Login, and Multi-Factor Authentication (2FA).
- **Integration**: The application is wrapped in `<ClerkProvider>` in `src/app/layout.tsx`.
- **Protection**: We do **not** use a global `middleware.ts` for route protection. Instead, protection is handled at the **Server Action/Page level** using helper functions like `ensureAuthorization` or `isSystemAdmin`.

### User Synchronization (Just-In-Time)
We use a **Just-In-Time (JIT)** provisioning strategy instead of Webhooks.

1.  **Trigger**: Sync happens when a user attempts to access the dashboard (invoking `ensureUserOrg` in `src/actions/client.ts`).
2.  **Check**: The system checks if a `User` record exists in the local PostgreSQL database matching the Clerk `userId`.
3.  **Creation**: If no user exists, one is created immediately.
4.  **Merging**: If a placeholder user (created via email invitation) exists with the same email:
    - Permissions (Memberships) are migrated to the new Clerk-authenticated user.
    - Comments and Activity logs are reassigned.
    - The placeholder user is deleted.

### Authorization (RBAC)
We utilize a custom Role-Based Access Control (RBAC) system, not Clerk's roles.

-   **Roles**: Defined in the `Membership` table (e.g., `ADMIN`, `MEMBER`, `CONTRIBUTOR`).
-   **Contexts**: Memberships are polymorphic, scoped to either an Organization (Party) or a specific ClientLE (Workspace).
-   **Logic**: `src/lib/auth/permissions.ts` defines the abilities (e.g., `can(user, 'create', 'engagement')`).

---

## 2. Future Considerations

### Review of Alternative Providers
*TODO: Evaluate other authentication providers to ensure long-term viability and cost-effectiveness.*

### Potential Improvements
-   **Webhooks**: If we need to trigger actions immediately upon sign-up (e.g., sending a welcome email *before* they log in), we may need to implement Clerk Webhooks (`user.created`).
-   **Middleware**: Re-evaluating global middleware for stricter edge-level route protection.

## 3. Password Management (Credentials Auth)

Passwords in the database are hashed using `bcrypt` and cannot be read or updated with plain text directly via SQL.

### Resetting a Password manually

Use the provided utility script to securely hash and update a user's password:

```bash
node scripts/set-password.js <email> <new-password>
```

**Example:**
```bash
node scripts/set-password.js mark@example.com MyNewPass123!
```
