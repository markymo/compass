# Momentum Dashboard Architecture

## Overview
The **Momentum Dashboard** is a mission-critical administrative surface designed to drive "Data Readiness" across the master field schema. It transitions the admin from passive monitoring to an active, habit-forming workflow by identifying gaps and recommending the next best action (NBA).

## 1. Core Readiness Definitions
Readiness is calculated based on three pillars for every active `MasterFieldDefinition`:
- **Valid Description**: String length ≥ 20 chars, no "TBC/TODO" placeholders.
- **UK CH Mapping**: Presence of a `SourceFieldMapping` for either `COMPANIES_HOUSE` or `REGISTRATION_AUTHORITY` (RA000585).
- **Fully Complete**: A field that satisfies both of the above.

## 2. The Observation Engine
To track progress over time without the complexity of snapshots or JSON blobs, we use **Momentum Observations**.

### Data Model: `AdminMomentumObservation`
- **Flat Structure**: Records `totalFields`, `described`, `mapped`, `complete`, and `actionsLeft`.
- **Scoped Metrics**: Every capture event records one `GLOBAL` row and one `CATEGORY` row per active category.
- **Deduplication**: Before saving, the system compares the current metrics against the latest global observation. If the readiness state hasn't moved (even by one action), the capture is skipped to prevent database noise.

## 3. Automation Workflow
- **Manual Capture**: A button in the UI allows admins to set a manual baseline.
- **Automated Capture**: Integrated into `updateMasterField`, `upsertSourceMapping`, and `deleteSourceMapping`.
- **Safety**: Automated captures are **awaited** but wrapped in `try-catch` blocks. If the momentum recording fails, the primary field save **remains successful**.

## 4. Delta & Trend Logic
The dashboard surfaces momentum by comparing live data against three specific historical baselines:
- **Last Capture**: The most recent row in the observation table.
- **Today**: The first row recorded after `00:00:00` local time today.
- **This Week**: The first row recorded since **Monday at 00:00:00**.

Deltas are displayed as subtle `+X` indicators on the summary cards.

## 5. Technical Stack
- **Frontend**: React (Next.js 15/16) with Tailwind CSS and Radix-based UI components.
- **Backend**: Server Actions (`momentum.ts`) and Prisma.
- **Logic Helpers**: Pure functions in `momentum-utils.ts` for statistics calculation and "Next Best Action" selection.

## 6. Known Production Recovery
> [!IMPORTANT]
> **Schema Drift Alert**: The production database currently requires a manual SQL patch to add the `sourceReference`, `mappingScope`, `payloadSubtype`, and `version` columns to `source_field_mappings` before Momentum can function correctly in the deployed environment. See the specific recovery SQL in the conversation history (May 1st, 2026).

## Future Roadmap
- **Slice 11**: Momentum Trends (Sparklines) showing the pace of work over 7 days.
- **Slice 12**: Admin Commitments (setting a target for "X fields ready by Friday").
- **Slice 13**: Snapshots & Persistence (Hardening the daily rollups).
