# OnPro Authoritative UI Guidelines

> [!IMPORTANT]
> **Authority Statement**: This document is the single authoritative source for OnPro UI, UX, and design system conventions. All engineering, component creation, and automated code editing must conform to the rules in this guide. Other UI documents under `/docs` (audits, plans, checklists) serve purely as historical supporting material.

---

## 1. Principles & Design Philosophy

OnPro is a high-density, professional enterprise application for corporate debt finance onboarding and data management. 

Our core design principles are:
1. **Annotate, Don't Compete**: Secondary metadata (assignments, status badges, timestamps) must annotate domain content, not visually overwhelm primary field values or titles.
2. **Standardize the Best Existing Behavior**: Prefer consolidating around existing modern OnPro patterns over inventing new design abstractions.
3. **Prefer Canonical Patterns Unless Justified**: Use the canonical visual and behavioral patterns defined herein unless an interaction has a clear semantic or usability reason to differ. Avoid mechanical rigidness where a specialized pattern produces strictly better UX.
4. **Independent Domain States**: Data State (*Populated* vs *Missing*), Assignment State (*Assigned* vs *Unassigned*), and Work State (*Open* vs *Done*) are strictly independent concepts. Missing data is NEVER automatically an open task or warning.

---

## 2. Design System Tokens & Color Palette

OnPro uses Tailwind CSS (v4) with CSS variables declared in `src/app/globals.css`.

### A. CSS Color Tokens (`globals.css`)
```css
:root {
  --background: #ffffff;           /* White */
  --foreground: #0f172a;           /* Slate 900 (Navy Header/Text) */
  --primary: #0f172a;              /* Slate 900 (Navy Brand Primary) */
  --primary-foreground: #f8fafc;   /* Slate 50 */
  --secondary: #f1f5f9;            /* Slate 100 */
  --secondary-foreground: #0f172a; 
  --accent: #eef2ff;               /* Indigo 50 (Soft Highlight) */
  --accent-foreground: #1e293b;    /* Slate 800 */
  --muted: #f8fafc;                /* Slate 50 */
  --muted-foreground: #64748b;     /* Slate 500 */
  --border: #e2e8f0;               /* Slate 200 */
  --popover: #ffffff;
  --popover-foreground: #0f172a;
}
```

### B. Functional Palette & Implementation Classes

| Role | Semantic Purpose | Implementation Tailwind Classes | Example Usage |
| :--- | :--- | :--- | :--- |
| **Brand Primary** | Page headers, primary buttons, major navigation | `bg-slate-900 text-white`, `text-slate-900` | Header titles, primary buttons |
| **Accent / Highlight** | Selection highlights, soft focus containers | `bg-indigo-50 text-indigo-900 border-indigo-200` | Selected rows, instruction highlights |
| **Neutral Surface** | Backgrounds, cards, muted panels | `bg-white`, `bg-slate-50/50`, `bg-slate-100` | Page background, cards, table headers |
| **Borders & Dividers** | Card borders, table gridlines | `border-slate-200`, `divide-slate-100` | Section dividers, input borders |
| **Primary Text** | Headings, primary titles, field claim values | `text-slate-900 font-semibold` / `font-bold` | Field values, entity names |
| **Body Text** | Descriptions, regular table values | `text-slate-700` / `text-slate-600` | Regular content text |
| **Muted Text** | Secondary metadata, captions, field numbers | `text-slate-500` / `text-slate-400` | Timestamps, field numbers, footers |
| **Completed / Success**| Verified items, completed work, approved state | `bg-emerald-50 text-emerald-800 border-emerald-200` | Done tasks, approved questions |
| **Warning / Risk** | Overwrite risks, unverified claims, caution | `bg-amber-50 text-amber-800 border-amber-200` | Action warnings, data collisions |
| **Error / Destructive**| System failure, severe error, destructive action | `bg-red-50 text-red-700 border-red-200`, `bg-destructive` | Delete actions, validation errors |
| **Focus Ring** | Keyboard focus affordance | `focus-visible:ring-2 focus-visible:ring-indigo-500/20` | Inputs, interactive buttons |

---

## 3. Typography & Text Hierarchy

OnPro uses **Outfit** for headings and **Inter** for standard body text, configured in `src/app/layout.tsx`.

```tsx
const outfit = Outfit({ variable: "--font-heading", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
```

### Typography Hierarchy

| Level | Font Family | Size & Weight | Tailwind Classes | Typical Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | Outfit (`font-heading`) | 24px (1.5rem) bold | `text-2xl font-bold text-slate-900 tracking-tight` | StandardPageHeader title |
| **Section Title** | Outfit (`font-heading`) | 18px / 20px font-bold | `text-lg font-bold text-slate-900` | Card header, section titles |
| **Field / Item Title**| Outfit or Inter | 14px / 16px font-semibold | `text-sm font-semibold text-slate-900` | Table row title, field label |
| **Canonical Claim Value**| Inter (`font-sans`) | 14px font-bold | `text-sm font-bold text-slate-900` | Prominent master field value |
| **Normal Body** | Inter (`font-sans`) | 14px (0.875rem) regular | `text-sm text-slate-700 leading-relaxed` | Descriptions, body copy |
| **Secondary / Muted** | Inter (`font-sans`) | 12px (0.75rem) medium | `text-xs text-slate-500` | Timestamps, assigners, sub-labels |
| **Micro Caption / Pill**| Inter (`font-sans`) | 10px uppercase bold | `text-[10px] uppercase font-bold tracking-wider` | Badges, category pills |

### Long-Form Text & Clamping Rules
- **Paragraphs**: User-authored or long-form descriptions must preserve paragraph spacing using `whitespace-pre-wrap`.
- **Inline Clamping**: Use `<ExpandableText text={description} maxLines={4} />` for inline descriptions to provide a seamless "Show more" / "Show less" toggle without disrupting row layouts.
- **Table Cell Truncation**: Use `truncate` (with `title="..."` or `<StandardTooltip />`) for tight table columns.

---

## 4. Spacing, Layout & Surfaces

- **Standard Page Container**: `max-w-7xl mx-auto px-6 py-8 space-y-6 w-full`
- **Section Spacing**: `space-y-6` between major page blocks; `space-y-4` inside cards.
- **Card & Panel Padding**:
  - Compact Cards: `p-4 rounded-xl border border-slate-200 bg-white shadow-xs`
  - Standard Panels: `p-6 rounded-xl border border-slate-200 bg-white shadow-sm`
- **Border Radius**:
  - Cards & Drawers: `rounded-xl` (12px)
  - Buttons, Inputs & Badges: `rounded-lg` (8px) or `rounded-full` (pills)
- **Side Drawers (`Sheet`)**: Standard width `w-full max-w-2xl sm:max-w-2xl` (`672px`), sliding in from the right (`side="right"`).

---

## 5. Buttons & Action Hierarchy

Buttons are styled via `src/components/ui/button.tsx`.

```tsx
<Button variant="default | secondary | outline | ghost | destructive" size="default | sm | lg | icon">
```

### Action Hierarchy Guidelines

| Button Variant | Visual Treatment | Intended Use Case | Example |
| :--- | :--- | :--- | :--- |
| **Primary (`default`)** | `bg-slate-900 text-white hover:bg-slate-800` | The single main action on a page or modal. | `[ Create Questionnaire ]`, `[ Save Changes ]` |
| **Secondary (`secondary`)**| `bg-slate-100 text-slate-900 hover:bg-slate-200` | Alternative supportive actions. | `[ Export PDF ]`, `[ Duplicate ]` |
| **Outline (`outline`)** | `border border-slate-200 bg-white hover:bg-slate-50` | Standard secondary actions, filter toggles, drawers. | `[ Assign ▾ ]`, `[ Clear Filters ]` |
| **Ghost (`ghost`)** | `hover:bg-slate-100 text-slate-700` | Low-prominence actions, table row actions, icon buttons. | `[ Cancel ]`, row action triggers |
| **Destructive (`destructive`)**| `bg-red-600 text-white hover:bg-red-700` | Irreversible or destructive actions inside confirmation modals. | `[ Delete Item ]`, `[ Revoke Access ]` |
| **Icon-Only (`size="icon"`)**| `h-8 w-8` or `h-9 w-9` centered icon button | Standalone quick actions. **Must include `title="..."` or `aria-label`.** | Edit pencil, close `X`, history icon |

---

## 6. Canonical Icon Vocabulary

OnPro standardizes icon usage via `lucide-react`. Raw text characters (`→`, `>`, `+`, `-`) must never be used as icon substitutes.

### Semantic Icon Mapping

| Interaction / Meaning | Canonical Icon (`lucide-react`) | Usage & Guidance |
| :--- | :--- | :--- |
| **Inspect / Open Side Drawer Action** | `<PanelRightOpen />` | Canonical icon when an explicit icon/button is rendered whose specific action is "inspect/open in side drawer". |
| **Navigate Internal Page / Route** | `<ArrowRight />` | Forward navigation to another internal page or wizard step. |
| **Navigate External Destination** | `<ExternalLink />` | Link leading outside OnPro or opening a raw document URL in a new tab. |
| **Back / Return Navigation** | `<ArrowLeft />` | Return to previous page or breadcrumb back action. |
| **Expand / Collapse Hierarchy** | `<ChevronRight />` (collapsed) / `<ChevronDown />` (expanded) | Tree views, collapsible categories, and accordions. |
| **Secondary Row Actions Menu** | `<MoreHorizontal />` | Dropdown trigger for table/card secondary actions. |
| **Close / Dismiss Overlay** | `<X />` | Icon-only close button on modals, toasts, and drawers. |
| **Edit Action** | `<Pencil />` or `<Edit />` | Modifying a field or entity definition. |
| **Delete / Destructive Action** | `<Trash2 />` | Deleting or soft-deleting an item (use `text-destructive`). |
| **Information / Context Help** | `<Info />` or `<HelpCircle />` | Contextual help tooltips and info alerts. |
| **User Person / Assignment** | `<UserIcon />` / `<Users />` | User avatars, team members, and assignees. |
| **Completed / Done State** | `<CheckCircle2 />` (badge) / `<Check />` (toggle button) | Completed task work or approved questions. |
| **Warning / Caution** | `<AlertTriangle />` | Action warnings, data collision risks. |
| **Error / Failure** | `<AlertCircle />` or `<XCircle />` | Validation failures and system errors. |
| **Instruction / Note** | `<FileText />` | Assignment instructions and field notes. |
| **Search Input** | `<Search />` | Search input icons. |
| **Filter Control** | `<Filter />` or `<SlidersHorizontal />` | Table and grid filter dropdown triggers. |
| **Client Corporate Entity** | `<Factory />` | Represents a Corporate Client / Group entity. |
| **Client Legal Entity (LE)** | `<Landmark />` | Represents a registered Legal Entity. |
| **Supplier / FI Entity** | `<Landmark />` | Represents a Bank, FI, or Service Provider. |

---

## 7. Semantic Status System

OnPro enforces strict visual rules for status badges. Data State, Assignment State, and Work State are independent concepts.

### Independence Rule
- **Data State**: *Populated* (value exists) vs *Missing Data* (no value).
- **Assignment State**: *Assigned* (responsibility given) vs *Unassigned* (no assignee).
- **Work State**: *Open* (work remaining) vs *Done* (work completed).
- *Missing Data is NEVER automatically an open task or warning.*

### Semantic Status Matrix

| Status | Semantic Meaning | Canonical Visual Treatment | Implementation Tailwind Classes | Canonical Icon |
| :--- | :--- | :--- | :--- | :--- |
| **Populated** | Canonical value exists | Soft Indigo / Slate neutral | `bg-indigo-50/60 text-indigo-900 border-indigo-200` | — |
| **Missing Data** | Value absent in record | Muted slate text (not an error) | `text-slate-400 font-normal italic` | — |
| **Assigned** | Responsibility assigned | Subtle Indigo badge | `bg-indigo-50 text-indigo-700 border-indigo-200` | `<UserIcon />` |
| **Unassigned** | No assignee | Muted slate text (clean) | `text-slate-400` | — |
| **Open Work** | **Work remaining** | **Neutral Slate badge / Slate pill** | `bg-slate-100 text-slate-700 border-slate-200` (or `bg-slate-200/80 text-slate-800`) | — |
| **Done Work** | Work completed | Soft Emerald badge | `bg-emerald-50 text-emerald-800 border-emerald-200` | `<CheckCircle2 />` |
| **Approved** | Formally verified & locked | Emerald badge | `bg-emerald-50 text-emerald-800 border-emerald-200` | `<CheckCircle2 />` |
| **Draft** | Unsubmitted working copy | Slate neutral badge | `bg-slate-100 text-slate-700 border-slate-200` | — |
| **Warning / Risk**| Attention / potential collision| Amber badge | `bg-amber-50 text-amber-800 border-amber-200` | `<AlertTriangle />` |
| **Error / Failed**| Severe error / validation crash| Red / Destructive badge | `bg-red-50 text-red-700 border-red-200` | `<AlertCircle />` |

> [!NOTE]
> **Open Work Color Rule**: `OPEN` work means work remains; it does NOT mean error, warning, or risk. It uses a neutral Slate treatment (`bg-slate-100 text-slate-700`). Do not use Amber or Red for normal `OPEN` work unless there is an explicit overdue or risk condition.

---

## 8. Management Tables & Row Interactions

### A. Table Structure
- **Page-Level Scrolling**: Tables occupy full width and use page-level vertical scrolling. Avoid nested fixed-height scroll containers (`CardContent` with `overflow-y-auto`) unless multi-pane mapping requires it.
- **Action Column Visibility**: Action buttons / row action triggers must always remain visible on the right edge.

### B. Clickable Row Interaction Rules
- **Domain Item Inspection**: A row or card representing an inspectable domain item (e.g. Master Field, Question, Requirement, Legal Entity) **MAY be clickable as a whole** to open its detail side drawer (as successfully implemented on `/master`).
- **Visual Affordance**: Clickable rows should display a subtle hover state (`hover:bg-slate-50/80 transition-colors cursor-pointer`).
- **No Mandatory Icon Requirement**: A whole-row click target does **NOT** require a `<PanelRightOpen />` icon on every single row if the interaction is clear. `<PanelRightOpen />` is used when an explicit button/icon is rendered.
- **Inner Control Isolation**: All nested interactive elements (dropdowns, inputs, buttons, links) **MUST call `e.stopPropagation()`** so interacting with them does not trigger drawer opening.
- **Keyboard Accessibility**: Clickable rows must be focusable (`tabIndex={0}`), handle `Enter` and `Space` keypresses, and carry `aria-haspopup="dialog"`.

---

## 9. Preferred Shared Components

Engineers should adopt standard shared primitives rather than recreating local variations:

1. **`StandardPageHeader`** (`src/components/layout/StandardPageHeader.tsx`):
   - *Usage*: Main page headers across platform routes with title, type label, subtitle, and breadcrumbs.
2. **`ConfirmDeleteDialog` / `ConfirmArchiveDialog` / `ConfirmHardDeleteDialog`** (`src/components/shared/confirm-dialogs.tsx`):
   - *Usage*: All destructive or archive action confirmations. **Bans native `window.confirm`.**
3. **`RowActionsMenu`** (`src/components/shared/row-actions-menu.tsx`):
   - *Usage*: Secondary row actions inside a `<MoreHorizontal />` dropdown menu.
4. **`StandardTooltip`** (`src/components/ui/standard-tooltip.tsx`):
   - *Usage*: Contextual tooltips with optional `dottedUnderline` for summary text.
5. **`ExpandableText`** (`src/components/ui/expandable-text.tsx`):
   - *Usage*: Long-form inline descriptions with "Show more" / "Show less" toggle.
6. **`sonner` Toast Notifications** (`src/components/ui/sonner.tsx`):
   - *Usage*: All non-blocking success/error feedback (`toast.success`, `toast.error`).

---

## 10. Behavioral Conventions

- **Save vs. Auto-Save**:
  - *Explicit Save*: Form workflows use an explicit `[ Save ]` button with loading state (`Loader2`).
  - *Auto-Save*: Inline inputs that auto-save on blur must provide subtle status feedback (`Saving...` → `Saved`).
- **Destructive Actions**: All delete/archive operations must be gated by a `ConfirmDeleteDialog` or `ConfirmArchiveDialog`. Never use browser-native `window.confirm`.
- **Toast Feedback**: Non-blocking toast feedback via `sonner` after async operations complete.
- **Filter Reset**: Tables and grids with filters must provide a clear `[ Clear all filters ]` action when zero results match.
- **Loading Feedback**: Async buttons must show a `Loader2` spinner and be `disabled` in-flight to prevent double-submissions.
- **Focus & Keyboard**: Interactive controls must feature visible focus rings (`focus-visible:ring-2 focus-visible:ring-indigo-500/20`) and full keyboard accessibility.
