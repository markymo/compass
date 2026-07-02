# CoParity UI Interaction Consistency & Semantics Audit

This document serves as an audit and proposed standard for UI interaction consistency, focusing primarily on destructive actions (Delete, Archive, Remove) and their underlying database/semantic implications across the CoParity Next.js app.

## 1. Proposed CoParity UI Interaction Standard

To unify the user experience and ensure safe data handling, we propose the following standards:

### Feedback and Modals
- **Toast Usage (`sonner`)**: Use for non-blocking success, warning, or error feedback after an action completes. Do not use for confirmations.
- **Modal/Dialog Usage**: Use `Dialog` for complex forms or workflows. Use `AlertDialog` exclusively for destructive or high-consequence confirmations.
- **Destructive Action Confirmations**: Never use `window.confirm` or `window.alert`. All destructive actions (soft-delete, hard-delete, archive) must be gated by a standardized `AlertDialog` component requiring explicit user confirmation.
- **Row Action Menus**: For tables or lists with multiple actions, use `DropdownMenu` with a `MoreHorizontal` icon rather than crowding the UI with standalone icons. Use a `Trash2` icon colored `text-destructive` inside the dropdown for delete/archive actions.

### Semantics
- **Delete (User-Facing)**: Implies **Soft Delete**. The item disappears from the user's UI. Behind the scenes, the row remains in the database (e.g., `isDeleted = true` or `deletedAt` set). It should *not* prevent the user from creating a new item with the same identifier in the future.
- **Archive**: Implies the item is hidden from primary workflows but is explicitly kept for historical reference or future reactivation. It should be recoverable via an "Archived Items" view.
- **Hard Delete (Admin-Only)**: True physical removal from the database. Must be explicitly labeled as "Hard Delete" or "Permanently Destroy" and gated behind an `AlertDialog` that requires typing a confirmation string (e.g., "DELETE").
- **Remove/Unlink**: Use when breaking a relationship (e.g., removing a user from a team) rather than deleting the underlying entity itself.

### UI Expectations
- **Button Labels**: Use verbs corresponding to the exact action ("Archive", "Delete", "Unlink", "Remove").
- **Loading States**: Buttons executing async operations must show a spinner (`Loader2`) and be `disabled` while in flight to prevent double-submissions.
- **Error Handling**: Catch backend errors and display them via `toast.error(res.error)`. Do not fail silently.
- **Accessibility**: Modals must trap focus. Destructive buttons must use appropriate `aria-label`s and `variant="destructive"`.

---

## 2. Codebase Scan Findings

An extensive scan of the `src` and `prisma` directories revealed the following usages:

### UI Components & Feedback
- **`toast`**: Heavily used via `sonner` across the app (`toast.success`, `toast.error`).
- **`window.confirm` / `alert`**: Used in several places (e.g., `src/app/(platform)/app/admin/master-data/source-mappings-v2/page.tsx`, `src/app/(platform)/app/admin/organizations/[id]/page.tsx`).
- **Modals**: A mix of `AlertDialog` and `Dialog` are used for confirmations, but without a centralized pattern. Some custom dialogs (`AddUserDialog`, `MappingFormDialog`) exist.
- **Row Actions**: `DropdownMenu` with `MoreHorizontal` is used in some tables, but standalone `Trash` or `Trash2` icon buttons are widely used directly inline (e.g., `test-client.tsx`, `remove-requirement-button.tsx`).

### Data Semantics & Flags
- **`isDeleted`**: Extremely widespread in `schema.prisma` across `ClientLE`, `Document`, `Questionnaire`, `AdminTodo`, etc. Defaults to `false`.
- **`archivedAt`**: Found in Master Data contexts (e.g., `MasterDataCategory`).
- **`status`**: Widely used. Many enums have specific states (`"ARCHIVED"` is used heavily for `Organization` and `ClientLE` filtering, e.g., `le.status !== "ARCHIVED"`).
- **Other Terms**: "Remove" and "Unlink" are used for memberships and graph bindings.

### Database Risks (Unique Constraints)
Soft-deletes (`isDeleted = true`) currently collide with standard `@@unique` constraints in `schema.prisma`. 
Notable risks include:
- `shortCode @unique` (Organization)
- `lei @unique` (ClientLE)
- `reference @unique`
- `@@unique([clientLEId, category])`
- `@@unique([fiOrgId, clientLEId])`
- `@@unique([clientLEId, fieldNo])`

If an entity is soft-deleted, its unique identifier remains claimed in the Postgres database. This will block a user from creating a new entity with the same identifier.

---

## 3. Matrix of Affected Components

| File/Component | Current Behaviour | Inconsistency / Problem | Target Pattern | Classification | Risk | Phase |
|---|---|---|---|---|---|---|
| `app/admin/master-data/source-mappings-v2/page.tsx` | Uses `window.confirm("Delete this mapping?")` | Browser-native confirm used instead of React dialog. | Use standard `ConfirmDeleteDialog`. | Hard Delete (Admin) | Low | 1 |
| `app/admin/organizations/[id]/page.tsx` | Uses `window.confirm` for archiving/unarchiving. | Browser-native confirm used. Archive is treated as a status toggle. | Use standard `ConfirmArchiveDialog`. | Archive | Low | 1 |
| `organizations/[id]/UserAccessModal.tsx` | Local `confirmRemove` state toggling a confirmation inline block. | Duplicated confirmation logic rather than using a standard modal. | Replace with `AlertDialog`. | Remove (Unlink) | Low | 2 |
| `admin/organizations/page.tsx` | Hard-codes an inline `DeleteOrgButton` dialog. | Duplicates `AlertDialog` boilerplate. | Use shared `ConfirmDeleteDialog`. | Soft Delete | Med | 1 |
| `client-le.ts` (Actions) | Filters out `isDeleted: true`. | Does not handle unique constraint collisions if LEI is soft-deleted. | Move to application-level uniqueness checks or partial DB indexes. | Soft Delete | High | 2 |
| `admin-todo-actions.ts` | Uses both `isDeleted` and `isArchived`. | Semantic overlap. Is it archived or deleted? | Decide on a single taxonomy. | Archive | Low | 2 |
| Inline `Trash2` buttons across app | Click directly deletes or triggers custom modal. | Clutters UI; inconsistent interaction model. | Move to `RowActionsMenu` dropdown. | Various | Med | 2 |

---

## 4. Shared Components

### Existing Components to become Canonical
- `components/ui/alert-dialog.tsx`: Should be the base for all destructive confirmations.
- `components/ui/dropdown-menu.tsx`: Should be the base for table row actions.
- `components/ui/sonner.tsx`: Canonical for toast notifications.

### New Components / Hooks to Create
1. **`ConfirmDeleteDialog`**: A highly reusable wrapper around `AlertDialog` that takes `title`, `description`, `onConfirm`, and `isLoading` props. Handles soft-deletes in user workflows.
2. **`ConfirmArchiveDialog`**: Similar to above, but styled and worded specifically for archiving (non-destructive removal).
3. **`ConfirmHardDeleteDialog`**: Admin-only. Requires the user to type a confirmation phrase to enable the submit button.
4. **`RowActionsMenu`**: A standard `DropdownMenu` composition that accepts an array of actions (e.g., Edit, Archive, Delete) and renders them uniformly with correct icons and text colors.

---

## 5. Critical Flags & Red Areas

🔴 **Soft-Delete Unique Constraint Blocking**
The most critical issue discovered. Because Prisma's `@unique` does not natively support partial indexes (e.g., `WHERE isDeleted = false`), soft-deleted rows still enforce their uniqueness. If a user soft-deletes a `ClientLE` with a specific `lei`, they can never create another `ClientLE` with that `lei` again.
- *Fix Required*: Unique constraints involving user-inputted identifiers (short codes, LEIs, references) must either be enforced at the application level (via `where: { identifier, isDeleted: false }`), or require a raw SQL partial index migration.

🔴 **Hard Delete Breaking Auditability**
If `delete` is called on Prisma models involving engagements, graph claims, or questionnaire answers, it physically cascades or breaks references. True physical deletion should be completely forbidden in normal user flows to preserve system auditability, especially for KYC data and version histories.

🔴 **Semantic Overlap (Delete vs Archive vs Deactivate)**
The terms are used interchangeably. For example, Organizations are "Archived" via `.status = "ARCHIVED"`, but AdminTodos have both `isDeleted` and `isArchived`. We must strictly separate:
- "Archive" = A user intent to hide something while retaining it.
- "Soft Delete" = A user intent to throw something away (handled by `isDeleted` for audit safety).

🔴 **Native Window Alerts**
Several admin pages use `window.confirm`. These block the main thread, look unprofessional, and cannot be styled to match the app's branding or show loading states. They must be removed immediately in Phase 1.
