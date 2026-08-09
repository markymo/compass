# OnPro Authoritative UI Guidelines

> [!IMPORTANT]
> **Authority Statement**: This document is the single authoritative source for OnPro UI, UX, and design system conventions. All engineering, component creation, and automated code editing must conform to the rules in this guide. Other UI documents under `/docs` (audits, plans, checklists) serve purely as historical supporting material.

---

## 1. Principles & Design Philosophy

OnPro is a high-density, professional enterprise application for corporate debt finance onboarding and data management. It deliberately uses a restrained visual language: predominantly white/off-white surfaces, dark navy typography, subtle slate structure, and small moments of saturated character color.

Our core design principles are:

1. **Colour Punctuates, Never Occupies**: *Colour should punctuate the interface, not occupy it.* OnPro remains overwhelmingly neutral. Saturated color is used sparsely as visual punctuation, not as surface paint.
2. **Neutral Structure Carries Hierarchy**: Typography, spacing, geometry, alignment, and whitespace carry the structural weight of the application. Neutral surfaces carry hierarchy; color adds character.
3. **Small Marks Over Large Surfaces**: Prefer small, disciplined lines, marks, and edges (e.g., 2px nav underlines, 3px footer edges) over tinted card backgrounds, colored headers, or heavy borders. Dense enterprise workspaces must remain visually calm.
4. **Contextual Section Identity**: Section identity is contextual rather than mandatory color coding. Related sections may share nearby colors (e.g., Question Bank indigo and Relationships purple). Every section does not require a unique hue.
5. **Annotate, Don't Compete**: Secondary metadata (assignments, status badges, timestamps, provenance) must annotate domain content, not visually overwhelm primary field values or section titles.
6. **Independent Domain States**: Data State (*Populated* vs *Missing*), Assignment State (*Assigned* vs *Unassigned*), and Work State (*Open* vs *Done*) are strictly independent concepts. Missing data is NEVER automatically an open task or warning.
7. **Standardize the Best Existing Behavior**: Prefer consolidating around existing modern OnPro patterns over inventing new design abstractions.

---

## 2. Color Systems Hierarchy & Tokens

OnPro enforces a strict hierarchy across five distinct color systems to prevent visual clutter and design drift.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. FOUNDATION BASE (85–95%)                                             │
│    White / off-white surfaces, Slate 900 Navy text, Slate 200 borders │
├────────────────────────────────────────────────────────────────────────┤
│ 2. CHARACTER ACCENTS (5–15%)                                           │
│    Sparse visual punctuation: 2px nav underline, 3px footer edge line  │
├────────────────────────────────────────────────────────────────────────┤
│ 3. FUNCTIONAL / SEMANTIC COLOUR                                        │
│    Statuses, workflow states (Approved, Draft, Warning, Error)         │
├────────────────────────────────────────────────────────────────────────┤
│ 4. PROVENANCE COLOUR                                                   │
│    Source badges (GLEIF, Registry, User Input, AI)                     │
├────────────────────────────────────────────────────────────────────────┤
│ 5. ENVIRONMENT SIGNALLING                                              │
│    Local Dev green & Staging purple ribbons (operational flags only)   │
└────────────────────────────────────────────────────────────────────────┘
```

### A. Hierarchy of Color Systems

1. **Foundation Base (Neutral Canvas)**:
   - **Surfaces**: White (`#ffffff`), off-white canvas (`bg-slate-50/50`), card backgrounds (`bg-white`).
   - **Typography**: Dark Navy / Slate 900 headings (`text-slate-900 font-semibold`), Slate 700 body copy (`text-slate-700`), Slate 500 muted text (`text-slate-500`).
   - **Structure**: Slate 200 borders (`border-slate-200`), Slate 100 row dividers (`divide-slate-100`).
   - *Constitutes the overwhelming majority of the application.*

2. **Character / Section Accents**:
   - Sparse expressive color used strictly as visual punctuation framing the workspace.
   - **Approved Structural Locations**:
     - **2px Active Navigation Underline** (`border-b-2 <navBorderClass>`)
     - **3px Full-Width Footer Top Edge Line** (`absolute -top-[1px] left-0 right-0 h-[3px] z-10 <footerAccentClass>`)
   - Both accents resolve from a single authoritative technical source of truth: [`src/config/section-accent.ts`](file:///opt/code/coparity/src/config/section-accent.ts) via `resolveSectionAccent(pathname)`.

3. **Functional / Semantic Colour**:
   - Status badges, warnings, errors, success, and workflow states (`APPROVED`, `DRAFT`, `RELEASED`, `WARNING`, `ERROR`).
   - *Conceptually separate from section character accents.*

4. **Provenance Colour**:
   - Source indicators and data claim badges (`GLEIF`, `REGISTRY`, `USER_INPUT`, `AI`).
   - *Conceptually separate from section character accents.*

5. **Environment Signalling**:
   - Operational testing flags (Local Dev green `bg-green-600` ribbon, Staging purple `bg-purple-600` ribbon).
   - *Operational indicators ONLY — must NOT influence or constrain production character-color decisions.*

---

### B. Approved Section Character Palette

The technical mapping is implemented in [`src/config/section-accent.ts`](file:///opt/code/coparity/src/config/section-accent.ts):

| Section / Product Area | Accent Name | Tailwind Token | 2px Nav Underline Class | 3px Footer Edge Class | Semantic Role / Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sources** | Sky / Blue | `sky-500` | `border-sky-500` | `bg-sky-500` | Primary source documents & registries |
| **Master Record** | Brand Orange | `orange-500` | `border-orange-500` | `bg-orange-500` | Canonical entity master data |
| **Relationships** | Purple | `purple-600` | `border-purple-600` | `bg-purple-600` | Supplier & engagement connections |
| **Question Bank** | Indigo / Violet | `indigo-600` | `border-indigo-600` | `bg-indigo-600` | Cross-questionnaire workbench |
| **Assignments** | Rose / Coral | `rose-600` | `border-rose-600` | `bg-rose-600` | Task allocations & assignments |
| **Supplier Portal** | Emerald | `emerald-600` | `border-emerald-600` | `bg-emerald-600` | Counterparty FI/supplier workspace |
| **Admin & Default** | Dark Slate / Navy | `slate-900` | `border-slate-900` | `bg-slate-900` | Administrative & core overview anchor |

---

### C. What Section Accent Does NOT Mean (Anti-Patterns)

Having a section accent token does **NOT** justify spreading color into page content. Specifically:

- ❌ **NO Coloured Page Headings or Body Text**: Page titles remain Dark Navy (`text-slate-900`).
- ❌ **NO Active Navigation Fills or Coloured Text/Icons**: Active nav tabs use Navy text (`text-slate-900 font-semibold`) and Slate 700 icons (`text-slate-700`). Active text and icons are NEVER recoloured to match the section accent.
- ❌ **NO Tinted Card Surfaces or Page Backgrounds**: Card containers remain white (`bg-white`).
- ❌ **NO Coloured Buttons or Icons Everywhere**: Primary buttons remain Slate 900 (`bg-slate-900 text-white`).
- ❌ **NO Coloured Table Rows or Thick Section Borders**: Gridlines remain subtle Slate 100/200.
- ❌ **NO Decorative Gradients or Rainbow Route Colouring**: Color is visual punctuation, not decorative fill.

---

### D. CSS Tokens & Implementation Classes (`globals.css`)

```css
:root {
  --background: #ffffff;           /* White Surface */
  --foreground: #0f172a;           /* Slate 900 (Navy Header/Text) */
  --primary: #0f172a;              /* Slate 900 (Navy Brand Primary) */
  --primary-foreground: #f8fafc;   /* Slate 50 */
  --secondary: #f1f5f9;            /* Slate 100 */
  --secondary-foreground: #0f172a; 
  --muted: #f8fafc;                /* Slate 50 */
  --muted-foreground: #64748b;     /* Slate 500 */
  --border: #e2e8f0;               /* Slate 200 */
}
```

| Role | Semantic Purpose | Implementation Tailwind Classes | Example Usage |
| :--- | :--- | :--- | :--- |
| **Brand Primary** | Page headers, primary buttons, major navigation | `bg-slate-900 text-white`, `text-slate-900` | Header titles, primary buttons |
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
| **Ghost (`ghost`)** | `hover:bg-slate-100 text-slate-700` | Low-prominence actions, table row actions, icon buttons. | `[ Cancel ]`, view action triggers (`Expand all`) |
| **Destructive (`destructive`)**| `bg-red-600 text-white hover:bg-red-700` | Irreversible or destructive actions inside confirmation modals. | `[ Delete Item ]`, `[ Revoke Access ]` |
| **Icon-Only (`size="icon"`)**| `h-8 w-8` or `h-9 w-9` centered icon button | Standalone quick actions. **Must include `title="..."` or `aria-label`.** | Edit pencil, close `X`, history icon |

---

## 6. Canonical Icon Vocabulary

OnPro standardizes icon usage via `lucide-react`. Raw text characters (`→`, `>`, `+`, `-`) must never be used as icon substitutes. Navigation and action icons remain neutral Slate 700 (`text-slate-700`).

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
| **Filter Control** | `<Filter />` or `<SlidersHorizontal />` | Table and grid filter popover or dropdown triggers. |
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
| **Open Work** | **Work remaining** | **Neutral Slate badge / Slate pill** | `bg-slate-100 text-slate-700 border-slate-200` | — |
| **Done Work** | Work completed | Soft Emerald badge | `bg-emerald-50 text-emerald-800 border-emerald-200` | `<CheckCircle2 />` |
| **Approved** | Formally verified & locked | Emerald badge | `bg-emerald-50 text-emerald-800 border-emerald-200` | `<CheckCircle2 />` |
| **Draft** | Unsubmitted working copy | Slate neutral badge | `bg-slate-100 text-slate-700 border-slate-200` | — |
| **Warning / Risk**| Attention / potential collision| Amber badge | `bg-amber-50 text-amber-800 border-amber-200` | `<AlertTriangle />` |
| **Error / Failed**| Severe error / validation crash| Red / Destructive badge | `bg-red-50 text-red-700 border-red-200` | `<AlertCircle />` |

---

## 8. Management Tables & Row Interactions

### A. Table Structure
- **Page-Level Scrolling**: Tables occupy full width and use page-level vertical scrolling. Avoid nested fixed-height scroll containers (`CardContent` with `overflow-y-auto`) unless multi-pane mapping requires it.
- **Action Column Visibility**: Action buttons / row action triggers must always remain visible on the right edge.

### B. Clickable Row Interaction Rules
- **Domain Item Inspection**: A row or card representing an inspectable domain item (e.g. Master Field, Question, Requirement, Legal Entity) **MAY be clickable as a whole** to open its detail side drawer.
- **Visual Affordance**: Clickable rows should display a subtle hover state (`hover:bg-slate-50/80 transition-colors cursor-pointer`).
- **Inner Control Isolation**: All nested interactive elements (dropdowns, inputs, buttons, links) **MUST call `e.stopPropagation()`**.
- **Keyboard Accessibility**: Clickable rows must be focusable (`tabIndex={0}`), handle `Enter` and `Space` keypresses, and carry `aria-haspopup="dialog"`.

---

## 9. Standard Filtering Architecture & Interaction Model

OnPro enforces a single product-wide standard for filtering and view controls across all data surfaces.

### A. Core Filtering Principles

1. **Search and Filters are Distinct Interaction Concepts**:
   - **Search**: *"Find items matching this text"*. Appears **first** in toolbar without generic filter icons beside it.
   - **Filters**: Restrict visible dataset according to structured domain properties.
2. **Primary vs. Additional Filters**:
   - Expose a maximum of **2–3 high-frequency primary filters** inline.
   - Primary filter triggers display their currently selected value (e.g., `[ Governance ▾ ]`).
3. **"More Filters" Popover**:
   - Specialist, secondary, or lower-frequency filters sit behind `[ More filters (n) ▾ ]`.
   - Organizes filters into distinct semantic groups (e.g., `FIELD PROPERTIES` vs `WORKFLOW & TASKS`).
   - Default values do not count as active filter count.
4. **Clear Action**:
   - Show `[ Clear filters ]` text action **only** when at least one structured filter is active.
5. **View Actions Must NOT Be Mixed With Filters**:
   - Actions like `Expand all`, `Collapse all`, or view density toggles are **View Actions**, NOT dataset filters.
   - View actions sit near section headings or layout controls, visually separate from filtering toolbars.

---

## 10. Preferred Shared Components

1. **`StandardPageHeader`** (`src/components/layout/StandardPageHeader.tsx`): Main page headers across platform routes.
2. **`ConfirmDeleteDialog` / `ConfirmArchiveDialog`** (`src/components/shared/confirm-dialogs.tsx`): Destructive action confirmations (**Bans native `window.confirm`**).
3. **`RowActionsMenu`** (`src/components/shared/row-actions-menu.tsx`): Secondary row actions inside `<MoreHorizontal />`.
4. **`StandardTooltip`** (`src/components/ui/standard-tooltip.tsx`): Contextual tooltips.
5. **`ExpandableText`** (`src/components/ui/expandable-text.tsx`): Long-form inline descriptions with toggle.
6. **`sonner` Toast Notifications** (`src/components/ui/sonner.tsx`): Non-blocking feedback (`toast.success`, `toast.error`).
7. **Section Accent Resolver** (`src/config/section-accent.ts`): Central mapping from route/section to 2px nav underline and 3px footer top edge accent classes.

---

## 11. Behavioral Conventions

- **Save vs. Auto-Save**: Explicit save forms use `[ Save ]` with loading spinner (`Loader2`). Auto-save inline inputs show status feedback (`Saving...` → `Saved`).
- **Destructive Actions**: Gated by `ConfirmDeleteDialog` or `ConfirmArchiveDialog`. Never use browser-native `window.confirm`.
- **Toast Feedback**: Non-blocking toast feedback via `sonner`.
- **Filter Reset**: Display `[ Clear filters ]` text action when at least one filter is active.
- **Focus & Keyboard**: Interactive controls must feature visible focus rings (`focus-visible:ring-2 focus-visible:ring-indigo-500/20`) and full keyboard accessibility.

---

## 12. Established Standards vs. Areas Open for Exploration

To maintain architectural stability while allowing future design iteration, this section clarifies what is finalized versus what remains open for design exploration.

### A. Established Standards (Finalized)
- **Section Accent Punctuation**: 2px active nav underline and 3px footer top edge line resolved centrally via `src/config/section-accent.ts`.
- **Foundation Neutrality**: Navy headings (`text-slate-900`), Slate body (`text-slate-700`), white/off-white canvas (`#ffffff` / `bg-slate-50/50`).
- **Neutral Active Text & Icons**: Active navigation text remains Slate 900 and icons remain Slate 700.
- **Product Filtering Interaction Model**: Search first, 2–3 primary filters, `More filters (n)` popover, distinct view actions.
- **Domain State Independence**: Data, Assignment, and Work states are strictly independent.

### B. Areas Open for Future Exploration
- **Status & Provenance Visual Redesign**: Refinements to badge shapes, micro-icons, or provenance indicators.
- **Additional Line & Geometry Motifs**: Explore subtle horizontal section dividers or secondary geometric markers if needed for dense multi-pane mapping.
- **Card Geometry & Shadow Systems**: Subtle evolutions to card radius, border weight, or elevation depth.
- **Micro-Animations & Motion**: Smooth transition physics for side drawers, popovers, or accordion collapse states.
