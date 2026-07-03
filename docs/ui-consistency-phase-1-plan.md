# UI Consistency & Semantics: Phase 1 Implementation Plan

## 1. Goal Description

This Phase 1 plan establishes the foundational UI patterns for destructive actions across CoParity without modifying business logic, database schemas, or backend semantics. The primary goal is to safely standardize user feedback and confirmations, replacing inconsistent UI patterns like `window.confirm` with robust, accessible React components. 

### Separation of Findings
To ensure safe incremental rollout, the audit findings are categorized into four phases:

*   **A. Pure UI consistency fixes (Phase 1 Focus)**: Standardizing buttons, dropdowns, alerts, and removing native `window.confirm`.
*   **B. Semantic label fixes (Phase 2)**: Standardizing "Archive" vs "Delete" language on buttons based on backend behavior.
*   **C. Backend soft-delete fixes (Phase 3)**: Unifying how soft-deletes and archives are stored (`isDeleted` vs `archivedAt` vs `status`).
*   **D. Database/unique-index fixes (Phase 4)**: Safely migrating schema constraints to support soft deletes.

## 2. Canonical Shared UI Components

We will create standard canonical components to be used across the app.

### A. ConfirmDeleteDialog
A standardized wrapper around `AlertDialog` specifically for soft deletes.
*   **Props**:
    *   `open: boolean`
    *   `onOpenChange: (open: boolean) => void`
    *   `title?: string` (Default: "Are you sure you want to delete this?")
    *   `description?: string`
    *   `onConfirm: () => Promise<void> | void`
    *   `isLoading?: boolean`
    *   `itemName?: string` (Optional context for the description)
*   **API/Usage**:
    ```tsx
    <ConfirmDeleteDialog 
      open={open} 
      onOpenChange={setOpen}
      itemName="Engagement Report"
      isLoading={isDeleting}
      onConfirm={async () => {
         await handleDelete();
         toast.success("Engagement Report deleted");
      }}
    />
    ```
*   **Accessibility & UX**: Uses `variant="destructive"` for the action button. Shows a `Loader2` spinner when `isLoading` is true and disables buttons to prevent double-click.

### B. ConfirmArchiveDialog
Functionally identical to `ConfirmDeleteDialog`, but semantically styled for Archiving (non-destructive removal from primary view).
*   **Props**: Same as `ConfirmDeleteDialog`.
*   **API/Usage**: Default title: "Archive this item?". The confirm button uses standard `default` or `secondary` variant, *not* `destructive`, as this is a reversible action. 

### C. ConfirmHardDeleteDialog
Admin-only wrapper for true database row removal. Requires the user to type a confirmation phrase.
*   **Props**:
    *   `...baseProps`
    *   `confirmationString: string` (e.g., "DELETE" or the exact name of the entity).
*   **API/Usage**: Includes an `<Input />` field. The "Permanently Delete" button is disabled until the input exactly matches `confirmationString`. Action button is `destructive`.

### D. RowActionsMenu
A standard composition of `DropdownMenu` for table rows or cards, encapsulating common actions like Edit, Archive, and Delete.
*   **Props**:
    *   `actions: Array<{ label: string, icon: ReactNode, onClick: () => void, variant?: 'default' | 'destructive', disabled?: boolean }>`
*   **API/Usage**:
    ```tsx
    <RowActionsMenu actions={[
        { label: "Edit", icon: <Pen />, onClick: () => setEditOpen(true) },
        { label: "Archive", icon: <ArchiveRestore />, onClick: () => setArchiveOpen(true) },
        { label: "Delete", icon: <Trash2 />, variant: "destructive", onClick: () => setDeleteOpen(true) }
    ]} />
    ```

## 3. Safest First Code Changes (Phase 1 Execution)

Phase 1 will strictly target **Pure UI consistency fixes (A)**.

1.  **Remove `window.confirm`**:
    *   `app/(platform)/app/admin/master-data/source-mappings-v2/page.tsx`
    *   `app/(platform)/app/admin/organizations/[id]/page.tsx`
    *   Replace these instances directly with the new `ConfirmDeleteDialog` and `ConfirmArchiveDialog`.
2.  **Consolidate Inline Confirmations**:
    *   `components/client/admin/organizations/page.tsx` (Extract inline `DeleteOrgButton` dialog to use shared component).
    *   `app/(platform)/app/admin/organizations/[id]/UserAccessModal.tsx` (Replace inline boolean state toggle with standard dialog).
3.  **Implement RowActionsMenu**:
    *   Apply to areas where `Trash2` is exposed standalone, moving it into a clean `MoreHorizontal` dropdown menu.

**Constraints:** No database fields will be changed. No server actions will be modified to change their backend deletion behavior.

## 4. Uniqueness Issue Recommendation (Phase 4 Planning)

Currently, soft deletes (`isDeleted = true`) collide with standard `@unique` or `@@unique` constraints in `prisma/schema.prisma`. 

### The Problem
If a `ClientLE` with `lei = "123"` is soft-deleted, `lei` remains in the database. A user trying to create a new `ClientLE` with `lei = "123"` will face a database crash due to the unique constraint. 

### Is Application Logic Enough?
Moving uniqueness validation exclusively to the application layer (e.g., `where: { lei, isDeleted: false }`) introduces race conditions. If two users submit the same LEI concurrently, the application check might pass for both, inserting duplicate active records. The database is the only safe source of truth for uniqueness.

### Do We Need Partial Unique Indexes?
**Yes.** We must enforce uniqueness only on active records.
PostgreSQL supports partial unique indexes: `CREATE UNIQUE INDEX client_le_lei_key ON "ClientLE" (lei) WHERE "isDeleted" = false;`

### Prisma Limitations
Prisma Schema *does not natively support partial unique indexes*. If we add `WHERE isDeleted = false`, Prisma cannot represent this via the `@unique` attribute in `schema.prisma`.

### Recommended Migration Strategy (DO NOT EXECUTE YET)
When we reach Phase 4, the correct strategy is:
1.  Remove the `@unique` or `@@unique` constraints from `schema.prisma` for fields affected by soft-deletes.
2.  Run `npx prisma migrate dev --create-only` to generate an empty migration.
3.  Manually edit the generated `.sql` file to drop the old unique index and create a new partial unique index:
    ```sql
    DROP INDEX "ClientLE_lei_key";
    CREATE UNIQUE INDEX "ClientLE_lei_key" ON "ClientLE"("lei") WHERE "isDeleted" = false;
    ```
4.  Apply the migration. Prisma will safely ignore the index during introspection, but PostgreSQL will enforce it.

## 5. Ordered Checklist of Commits for Phase 1

- [ ] `feat(ui): create ConfirmDeleteDialog, ConfirmArchiveDialog, and ConfirmHardDeleteDialog components`
- [ ] `feat(ui): create RowActionsMenu standard component`
- [ ] `refactor(ui): replace window.confirm with ConfirmArchiveDialog in organization admin`
- [ ] `refactor(ui): replace window.confirm with ConfirmDeleteDialog in source-mappings-v2`
- [ ] `refactor(ui): replace inline deletion dialogs with ConfirmDeleteDialog in organizations page and UserAccessModal`
- [ ] `refactor(ui): adopt RowActionsMenu for standalone Trash buttons in specific table views`

### E. StandardTooltip
A standardized wrapper around `Tooltip` from Shadcn to ensure consistent hover interactions without relying on ugly `cursor-help` question marks.
*   **Props**:
    *   `content: ReactNode` (The tooltip text/content)
    *   `children?: ReactNode` (The trigger element)
    *   `dottedUnderline?: boolean` (Optional affordance)
    *   `iconClassName?: string`
    *   `contentClassName?: string`
*   **API/Usage**:
    ```tsx
    <StandardTooltip content="Based on the most recent successful sync.">
      <span>Last validated: 01/01/2026</span>
    </StandardTooltip>
    ```
*   **Accessibility & UX**: Uses a small Lucide `Info` icon appended to the children to clearly indicate hoverable content. The tooltip itself uses `bg-emerald-600 text-white` for a modern, distinct look.
