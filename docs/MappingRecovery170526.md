# FMSB Mapping Recovery — Handover Notes
**Date:** 17 May 2026 (00:55)  
**Status:** Paused — awaiting co-founder sign-off before DB changes  
**Owner:** Mark + co-founder

---

## The Problem

A user reported that the questionnaire **"FMSB Standard - UK V2"** was "forgetting" mapped fields. Investigation revealed two root causes:

1. **No auto-save** — the mapping editor stored changes only in browser state until the user clicked Save. Navigating away or triggering a page refresh silently discarded all unsaved work.
2. **Duplicate questionnaire records** — the same questionnaire had been created 5 times in the production database, with the live instance being a blank copy that had never been saved to.

---

## Database State (Production — Neon)

Six records exist with the name "FMSB Standard - UK V2":

| ID (short) | Created | isDeleted | isGlobal | Last Updated | Notes |
|---|---|---|---|---|---|
| `e5f593fd` | 8 May | ❌ No | ✅ **Yes** | 11 May | **Original global template — most complete mappings** |
| `b649984e` | 11 May | ✅ Yes | No | 16 May | Deleted copy |
| `7a2adf22` | 13 May | ✅ Yes | No | 16 May 22:18 | Deleted copy |
| `e2494e65` | 14 May | ✅ Yes | No | 16 May 09:17:03 | Deleted copy |
| `431c9e3a` | **16 May 09:17:11** | ❌ No | No | **09:17:11 (never saved)** | ⬅️ **This is the live instance users see** |
| `9a2ff4a4` | 16 May 09:23 | ✅ Yes | No | 16 May 12:40 | Deleted copy |

**Key finding:** `431c9e3a` was created 8 seconds after `e2494e65` was deleted — a sign that the "Add from Library" dialog was submitted multiple times, creating a fresh blank copy each time. The live instance has `updatedAt = createdAt` meaning it has **never been saved to**.

---

## Code Fixes Already Deployed

### 1. Auto-save on mapping change (`questionnaire-mapper.tsx`)
- Mapping field changes (masterFieldNo, masterQuestionGroupId, customFieldDefinitionId, allowAttachments) now trigger a **1.5-second debounced save** automatically
- A status indicator in the header shows: `Unsaved changes` → `Saving…` → `Saved` (fades after 3s)
- Text edits (question text, compact label) still require manual Save to avoid excessive writes
- Manual Save button cancels any pending auto-save and runs immediately

### 2. Idempotent questionnaire assignment (`questionnaire.ts`)
New function: `assignQuestionnaireToEngagement(templateId, engagementId)`
- Before creating a new questionnaire row, checks if a non-deleted instance already exists for that engagement + template name combination
- If one exists → returns it (no new row)
- If not → creates one (with full question + mapping clone from template)
- The "Add from Library" dialog now calls this instead of bare `createQuestionnaire`
- **This prevents future duplicate creation**

---

## Orphan Audit Results

Ran Section 7 summary query against production:

| Check | Count |
|---|---|
| FMSB duplicate questionnaires | 6 |
| Mapped questions on soft-deleted questionnaires | **25** (6 unique positions) |
| Free-floating instances (no engagement, not template) | 0 ✅ |
| Questions with dangling masterFieldNo (field deleted) | 0 ✅ |
| Source mappings targeting an inactive master field | 0 ✅ |
| Source mappings with no matching master field at all | 0 ✅ |

The only issue is the 25 orphaned question mappings on deleted copies — these are the "lost" mapping work.

---

## Mapping Analysis

We ran a consensus analysis across all deleted copies, then queried the global template (`e5f593fd`) as the primary source.

### Global template mappings (authoritative)

| # | Question | Maps to | Field Name |
|---|---|---|---|
| 1 | LEGAL NAME | Field 3 | Legal name |
| 2 | PREVIOUS NAMES | Field 5 | Previous name |
| 3 | LEGAL FORM | Field 24 | Entity legal form local name |
| 4 | LEGAL REGISTERED ADDRESS | Group: REGISTERED_ADDRESS | *(already set on live instance)* |
| 6 | COUNTRY OF INCORPORATION | Field 22 | Country of formation |
| 8 | DATE OF ESTABLISHMENT | Field 27 | Registration date |
| 9 | REGISTRATION NUMBER | Field 18 | Registered number |
| 10 | TAX NUMBER | Field 81 | Tax ID by country |
| 12 | INDUSTRY TYPE | Field 20 | Industry Classification - UK SIC |
| 13 | NATURE OF BUSINESS | Field 80 | Description of principal activities |
| 14 | NAME OF REGULATOR | Field 25 | Entity legal form transliterated name ⚠️ |
| 30 | TRADING NAME | Field 4 | Trading name |
| 35 | DIRECT SHAREHOLDERS | Field 60 | Certificate of incorporation ⚠️ |
| 37 | UBOs | Field 64 | List of persons controlling |

⚠️ = **Looks like a mis-mapping in the original template. Excluded from recovery. Needs co-founder decision.**

### Supplementary mappings from deleted copies (not in global template)

| # | Question | Maps to |
|---|---|---|
| 5 | PRINCIPAL PLACE OF BUSINESS | Group: HEADQUARTERS_ADDRESS |
| 7 | COUNTRY OF REGISTRATION (IF DIFFERENT) | Field 9 — Registered address country |

### Never mapped in any version (22 questions — need manual UI work)

Orders 11, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 36, 38

(TAX RESIDENCE, REGULATORY STATUS, TENURE OF REGULATION, NAME OF EXCHANGE, LISTING STATUS, SANCTIONS COMPLIANCE, PURPOSE OF RELATIONSHIP, INITIAL FUNDING AMOUNT, TYPE OF FUNDS, SOURCE OF FUNDS, SOURCE OF WEALTH, ANTICIPATED TRANSACTION ACTIVITY, REDEMPTION CYCLE, AML PROGRAMME, HOME REGULATOR, LICENSE TO OPERATE, ORGANISATION CHART, KEY CONTROLLERS, AUTHORISED SIGNATORIES, ACCOUNT OPENING AGENT, INDIRECT SHAREHOLDERS, SENIOR MANAGING OFFICIAL)

---

## Recovery Plan — Awaiting Sign-off

**The decision document for the co-founder is at:**  
`docs/FMSB_mapping_recovery_review_170526.md`  
(or see the artifact shared with him — same content, formatted for easy reading)

### Summary of proposed recovery

| Status | Count |
|---|---|
| Already mapped — no action | 1 (order 4) |
| Will restore automatically | **13** |
| Excluded — needs co-founder call | 2 (orders 14, 35) |
| Never mapped — manual UI work | 22 |
| **Total** | **38** |

---

## When You Resume — Step by Step

### Step 1: Get the decision
Review `docs/FMSB_mapping_recovery_review_170526.md` with co-founder.  
He needs to:
- Approve / reject the 13 proposed restorations
- Decide correct fields for questions 14 and 35

### Step 2: Run the recovery SQL (if approved)
File: `docs/orphaned_mappings_audit_160526_recovery.sql`

In Neon SQL editor:
1. Run **Step 1** (preview SELECT) — confirm the 13 rows look correct
2. Run **Step 2** (BEGIN → COMMIT) — expected rowcount: ~13
3. Run **Step 3** (verify SELECT) — confirm live instance now has mappings

### Step 3: Fix questions 14 and 35 manually
Open: `https://coparity.tech/app/admin/questionnaires/431c9e3a-eb07-4652-9c37-8e8ecf3b4f56`  
Set the mappings for those two questions in the UI — **auto-save will capture them immediately**.

### Step 4: Map the remaining 22 questions
Work through the 22 unmapped questions in the UI. Auto-save means every selection is written to the DB within 1.5 seconds — no more lost work.

### Step 5: Optionally update the global template too
If the global template (`e5f593fd`) had wrong mappings for questions 14 and 35, consider correcting those too so future copies get the right values.

---

## Files Reference

| File | Purpose |
|---|---|
| `docs/orphaned_mappings_audit_160526.sql` | Original audit queries (Sections 1–7) |
| `docs/orphaned_mappings_audit_160526_recovery.sql` | Recovery SQL — Steps 1, 2, 3 |
| `docs/FMSB_mapping_recovery_review_170526.md` | Co-founder sign-off document |
| `docs/MappingRecovery170526.md` | This file — full handover notes |
| `docs/Source_Mappings_Audit_160526.md` | Separate audit of Source Mappings page (different issue) |

---

## Related Code Changes Made Tonight

| File | Change |
|---|---|
| `src/components/client/engagement/questionnaire-mapper.tsx` | Auto-save on mapping change, status indicator |
| `src/actions/questionnaire.ts` | New `assignQuestionnaireToEngagement` (idempotent) |
| `src/components/client/engagement/add-questionnaire-dialog.tsx` | Wired to use new idempotent action |
