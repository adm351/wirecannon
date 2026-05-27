# Changelog

## 0.1.1

### Language

- **ButtonDropdown** now accepts child components instead of a CSV `options` attribute. Menu items are declared as `Button`, `Divider`, or `Text` children, enabling mixed-content menus (e.g. labelled sections, danger actions)
- **Button** gains a new `variant:label` that renders as an uppercase text label with no background or border, for use inline alongside other labels
- **Col** gains `align` (maps to `justify-content` on the column axis) and `grow` (sets `flex-grow:1; height:100%`) attributes, matching the existing `Row` feature set
- **ButtonGroup** `align` values standardised to `start` / `center` / `end` (was `left` / `right` / `center`) for consistency with all other layout alignment attributes. Note: `Button align` retains `left` / `center` / `right` as it controls text alignment within the button
- **Nav** is now a permitted child of `Section`, `Main`, and `Sidebar`, enabling tab-bar patterns inside page regions
- **Table row parsing** changed from a pipe-character heuristic to an ancestor-context check — a line is treated as a row only when its direct parent is a `[Table]` node

### Dev server

- Added **Screens** and **Flows** tabs to the sidebar. The Screens tab includes live search; the Flows tab renders a flowchart of decision trees with click-through navigation to individual screens
- Wireframe **min-height** in dev view now uses `calc(100vh - 102px)` (viewport minus toolbar and padding) rather than a fixed `600px` floor
- **Hotspot animation** — on page load, a single sonar-ping animation highlights all clickable elements (`a.wcf-button`, dropdown triggers) so interactive regions are immediately obvious

### VS Code extension

- Added logo (`images/logo.png`) and a full-featured README covering linting, autocomplete, and preview features
- Added `repository` field to `package.json` to satisfy vsce packaging requirements

---

## 0.1.0

Initial release