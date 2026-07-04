# Phase 1B: Remaining window.confirm Audit

This document catalogues the remaining `window.confirm` and `confirm` usages across the codebase, outlining the risk level and the recommended replacement component for each. 

| File Path | Line/Context | Action Confirmed | User/Admin | Classification | Current Backend Behaviour | Risk Level | Recommended Replacement | Suggested Phase |
|---|---|---|---|---|---|---|---|---|
| `app/admin/feedback/client.tsx` | 83 | Delete feedback | Admin | Delete | Hard delete row | Low | `ConfirmDeleteDialog` | Phase 2 |
| `app/le/[id]/v2/questionnaire/[questionnaireId]/page.tsx` | 64 | Re-analyze document | User | Other | Overwrites extraction data | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/fi/questionnaire-actions.tsx` | 28 | Archive questionnaire | User | Archive | Sets status=ARCHIVED | Low | `ConfirmArchiveDialog` | Phase 2 |
| `components/fi/questionnaire-actions.tsx` | 41 | Delete questionnaire | User | Delete | Hard/Soft delete | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/fi/engagement-actions.tsx` | 28 | Archive engagement | User | Archive | Sets status=ARCHIVED | Low | `ConfirmArchiveDialog` | Phase 2 |
| `components/fi/engagement-actions.tsx` | 41 | Delete engagement | User | Delete | Hard/Soft delete | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/admin/admin-todo-dialog.tsx` | 98 | Delete task | Admin | Delete | Soft delete (`isDeleted=true`) | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/admin/questionnaire/questionnaire-row-actions.tsx` | 29 | Delete questionnaire | Admin | Delete | Hard delete row | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/admin/questionnaire/questionnaire-manager.tsx` | 258 | Use browser OCR | Admin | Other | Heavy browser processing | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/document-vault.tsx` | 123 | Delete document | User | Delete | Hard delete file/row | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/engagement/engagement-team-manager.tsx` | 25 | Revoke invitation | User | Remove | Deletes invitation row | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/engagement/questionnaire-mapper.tsx` | 281 | Auto-Map with AI | User | Other | Bulk overwrite mappings | High | Custom `Dialog` | Phase 3 |
| `components/client/questionnaire-library.tsx` | 110 | Remove questionnaire | User | Remove | Deletes relationship | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/team-page-client.tsx` | 40 | Revoke invitation | User | Remove | Deletes invitation row | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/engagement/engagement-detail-view.tsx` | 99 | Remove entity from engagement | User | Remove | Deletes relationship | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/engagement/engagement-detail-view.tsx` | 131 | Revoke invitation | User | Remove | Deletes invitation row | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/engagement/questionnaire-manage-dialog.tsx` | 110 | AI re-analyze mappings | User | Other | Bulk overwrite mappings | High | Custom `Dialog` | Phase 3 |
| `components/client/admin/group-items-table.tsx` | 99 | Delete item | Admin | Delete | Hard delete | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/engagement/engagement-document-manager.tsx` | 68 | Revoke document access | User | Remove | Deletes visibility grant | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/client-le-actions.tsx` | 30 | Archive LE | User | Archive | Sets status=ARCHIVED | Low | `ConfirmArchiveDialog` | Phase 2 |
| `components/client/client-le-actions.tsx` | 44 | Soft Delete LE | User | Delete | Sets `isDeleted=true` | Medium | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/client-le-actions.tsx` | 58 | Force Delete LE | Admin | Delete | Cascading Hard Delete | High | `ConfirmHardDeleteDialog` | Phase 2 |
| `components/client/remove-requirement-button.tsx` | 14 | Remove questionnaire | User | Remove | Deletes relationship | Low | `ConfirmDeleteDialog` | Phase 2 |
| `components/client/version-history.tsx` | 52 | Create snapshot | User | Other | Generates PDF, Snapshot | Medium | Custom `Dialog` | Phase 3 |
| `components/client/inspection/field-detail-panel.tsx` | 790 | Apply candidate value | User | Other | Updates master field | Low | `ConfirmDeleteDialog` | Phase 2 |
