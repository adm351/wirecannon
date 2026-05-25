# Wirecannon for Visual Studio Code

<img src="images/logo.png" width="80" alt="Wirecannon logo"/>

Language support for [Wirecannon](https://github.com/adm351/wirecannon) — the text-based wireframing DSL for humans, models, and renderers.

---

## Features

### Linting

Grammar errors are highlighted as you work. The extension walks up from the open file to find `index.wcf`, lints the entire project, and shows diagnostics inline across all `.wcf` files.

Errors are reported with the rule number and a description — the same output you would see from the CLI linter.

Diagnostics update on file open and on save.

### Autocomplete

Context-aware completions at every position inside a component declaration:

- **Component type** — suggests all valid component names after `[`
- **Attribute keys** — suggests attributes for the current component; required attributes are marked with `*`; already-used attributes are excluded
- **Attribute values** — suggests valid enum values after `key:`; boolean attributes insert without a value
- **Comment keys** — suggests the full annotation vocabulary after `#`

`index.wcf` receives a separate completion set covering `Project`, `Screen`, `Overlay`, `Flow`, and their specific attributes.

### Live Preview

Open a side-by-side rendered preview of any `.wcf` file with the **Wirecannon: Show Preview** command, or click the preview icon (⊞) in the editor toolbar.

The preview updates as you type. Switching to a different `.wcf` file in the editor automatically loads that file in the preview pane.

**Link navigation** — buttons with a `target:` attribute render as clickable links. Clicking them loads the target screen or overlay in the preview pane, so you can walk through a flow without leaving VS Code.

---

## Usage

### Opening the preview

- Click the preview icon in the editor toolbar when a `.wcf` file is active, or
- Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run **Wirecannon: Show Preview**

### Understanding diagnostics

Errors appear as red underlines on the offending line. Hover to see the rule number and description. The Problems panel (`Cmd+Shift+M`) lists all errors across the project.

Each rule maps to a constraint in the [Wirecannon grammar](https://github.com/adm351/wirecannon/blob/main/GRAMMAR.md). The rule number in parentheses (e.g. `[Rule 13]`) corresponds to the numbered rules in the Validation Rules section of the grammar spec.

---

## Configuration

| Setting | Values | Default | Description |
|---|---|---|---|
| `wirecannon.previewTheme` | `bw`, `flexoki` | `bw` | Colour theme used in the preview pane |

Set via **Settings** → search for `wirecannon`.

---

## Requirements

- VS Code 1.85 or later
- A Wirecannon project with an `index.wcf` manifest at the project root

The extension locates the project root by walking up from the open file until it finds `index.wcf`. Files outside a Wirecannon project will not show diagnostics.

---

## Related

- [`@wirecannon/linter`](https://www.npmjs.com/package/@wirecannon/linter) — CLI linter
- [`@wirecannon/renderer`](https://www.npmjs.com/package/@wirecannon/renderer) — HTML and SVG renderer
- [Wirecannon grammar specification](https://github.com/adm351/wirecannon/blob/main/GRAMMAR.md)
