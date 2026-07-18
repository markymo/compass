# Migration History Debt & Shadow DB Issues

**Status as of July 2026**:
- **Production & Development environments**: Functional and working properly. The current `prisma/schema.prisma` is aligned with the active databases.
- **Migration History Replay**: Currently **BROKEN**. Attempting to build a shadow database or spin up a completely fresh test database from the migration history will fail.

**Root Cause**:
The issue is caused by the February 2026 migration (`20260228110900_drop_tier1_legacy_tables`). It contains a hardcoded `"public".` schema reference (`DROP TYPE "public"."DocumentOwnerType_old";`). When Prisma attempts to run the history inside a schema-isolated shadow database, this hardcoded reference escapes the shadow schema and causes a fatal crash.

**Deferred Action**:
A deliberate baselining or migration-history repair exercise has been explicitly deferred until after the July 2026 Sunday deadline. Do NOT edit historical migrations or run `migrate resolve` to fix this until explicitly authorized.
