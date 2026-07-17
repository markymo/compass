# UI Guidelines

This document establishes standard UI conventions for the application, ensuring consistency across management screens, tooltips, and row actions.

## 1. Management Tables
- **Page-Level Scrolling:** Data tables should occupy the full page width and allow for natural page-level vertical scrolling.
- **Avoid Nested Scrolling:** Do not place tables inside fixed-height scroll containers (e.g., restricted `CardContent` with `overflow-y-auto`).
- **Avoid Horizontal Scrolling:** Optimize column widths and use truncation or wrapping where appropriate so tables fit comfortably within normal desktop widths without requiring horizontal scrolling.
- **Visibility:** Primary action columns must always remain visible on the screen.

## 2. Row Actions
- **Primary Action:** The most common action (typically `Edit`) should be exposed directly as a visible icon button (e.g., `Pencil` or `Edit` icon).
- **Secondary Actions:** Less frequent or destructive actions (e.g., `Delete`, `Duplicate`, `History`) should be placed inside a `DropdownMenu` triggered by a `MoreHorizontal` icon. 
- **Tooltips:** Standalone icon buttons should always have an accessibility label or tooltip indicating their function.

## 3. Tooltips & Summaries
- **Text Triggers:** When summarizing long lists of data (e.g., "Used in 3 fields"), reuse the established `StandardTooltip` pattern where the text itself is the trigger. 
- **Styling:** Set `dottedUnderline=true` on the `StandardTooltip` to visually indicate that the text is interactive. This pattern is prevalent in Master Data screens.
- **Hover/Focus:** The tooltip should seamlessly appear on mouse hover or keyboard focus, displaying the expanded detailed list without increasing the row height of the table.
